"""Orchestrator — runs pipeline, evaluates, traces, and gates."""

from __future__ import annotations

import uuid
from typing import Literal

from rich.console import Console
from rich.table import Table

from ai_validator.app.rag_pipeline import RAGPipeline
from ai_validator.config import Settings, get_settings
from ai_validator.datasets.golden_dataset import get_golden_dataset
from ai_validator.evaluators.base import BaseEvaluator
from ai_validator.evaluators.deepeval_evaluator import DeepEvalEvaluator
from ai_validator.evaluators.mock_evaluator import MockEvaluator
from ai_validator.evaluators.ragas_evaluator import RagasEvaluator
from ai_validator.gates.quality_gate import QualityGate
from ai_validator.models import RunReport
from ai_validator.observability.langfuse_tracer import LangfuseTracer

EvaluatorBackend = Literal["mock", "ragas", "deepeval", "auto"]
console = Console()


def create_evaluator(
    backend: EvaluatorBackend = "auto",
    settings: Settings | None = None,
) -> BaseEvaluator:
    settings = settings or get_settings()

    if backend == "auto":
        if settings.is_mock_mode:
            backend = "mock"
        else:
            try:
                import ragas  # noqa: F401
                backend = "ragas"
            except Exception:
                backend = "mock"

    if backend == "mock":
        return MockEvaluator(settings)
    if backend == "ragas":
        return RagasEvaluator(settings)
    if backend == "deepeval":
        return DeepEvalEvaluator(settings)

    raise ValueError(f"Unknown backend: {backend}")


class ValidationRunner:
    """Main entry point: run golden dataset through your AI app and evaluate."""

    def __init__(
        self,
        pipeline: RAGPipeline | None = None,
        evaluator: BaseEvaluator | None = None,
        tracer: LangfuseTracer | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.pipeline = pipeline or RAGPipeline(settings=self.settings)
        self.evaluator = evaluator or create_evaluator(settings=self.settings)
        self.tracer = tracer or LangfuseTracer(self.settings)
        self.gate = QualityGate(self.settings)

    def run(
        self,
        evaluator_backend: EvaluatorBackend = "auto",
    ) -> RunReport:
        if evaluator_backend != "auto":
            self.evaluator = create_evaluator(evaluator_backend, self.settings)

        run_id = str(uuid.uuid4())[:8]
        test_cases = get_golden_dataset()
        mode = "mock" if self.settings.is_mock_mode else "live"

        console.print(f"\n[bold]AI Validation Run[/bold] id={run_id} mode={mode}")
        console.print(f"Evaluator: {self.evaluator.name}")
        console.print(f"Langfuse: {'enabled' if self.tracer.enabled else 'disabled'}\n")

        pipeline_results = []
        for tc in test_cases:
            with self.tracer.trace_rag_query(tc.question, metadata={"test_case_id": tc.id}) as trace:
                result = self.pipeline.run_test_case(tc)
                pipeline_results.append(result)
                self.tracer.log_run_result(trace, result)

        eval_results = self.evaluator.evaluate_batch(pipeline_results, test_cases)

        if self.tracer.enabled:
            eval_map = {e.test_case_id: e for e in eval_results}
            for tc in test_cases:
                eval_result = eval_map.get(tc.id)
                if eval_result is None:
                    continue
                with self.tracer.trace_rag_query(
                    tc.question, metadata={"test_case_id": tc.id, "phase": "evaluation"}
                ) as trace:
                    run = next(r for r in pipeline_results if r.test_case_id == tc.id)
                    self.tracer.log_run_result(trace, run)
                    self.tracer.log_evaluation_scores(trace, eval_result)
            self.tracer.flush()

        gate_result = self.gate.check(
            RunReport(
                run_id=run_id,
                mode=mode,
                results=eval_results,
                pipeline_results=pipeline_results,
            )
        )

        report = RunReport(
            run_id=run_id,
            mode=mode,
            results=eval_results,
            pipeline_results=pipeline_results,
            gate_passed=gate_result.passed,
            gate_failures=gate_result.failures,
        )

        self._print_report(report)
        self._print_gate(gate_result)
        return report

    def _print_report(self, report: RunReport) -> None:
        table = Table(title="Evaluation Results")
        table.add_column("Test Case")
        table.add_column("Faithfulness")
        table.add_column("Answer Relevancy")
        table.add_column("Context Precision")

        for result in report.results:
            f = result.get("faithfulness")
            r = result.get("answer_relevancy")
            c = result.get("context_precision")
            table.add_row(
                result.test_case_id,
                f"{f.score:.3f}" if f else "—",
                f"{r.score:.3f}" if r else "—",
                f"{c.score:.3f}" if c else "—",
            )

        console.print(table)

        console.print("\n[bold]Aggregates:[/bold]")
        for name in ("faithfulness", "answer_relevancy", "context_precision"):
            avg = report.aggregate(name)
            if avg > 0:
                console.print(f"  {name}: {avg:.3f}")

    def _print_gate(self, gate_result) -> None:
        if gate_result.passed:
            console.print("\n[bold green]QUALITY GATE: PASSED[/bold green]")
        else:
            console.print("\n[bold red]QUALITY GATE: FAILED[/bold red]")
            for failure in gate_result.failures:
                console.print(f"  - {failure}")
