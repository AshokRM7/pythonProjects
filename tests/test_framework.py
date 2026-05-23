"""Unit tests for the validation framework (no API keys required)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ai_validator.app.rag_pipeline import RAGPipeline, SimpleRetriever
from ai_validator.datasets.golden_dataset import get_golden_dataset
from ai_validator.evaluators.mock_evaluator import MockEvaluator
from ai_validator.gates.quality_gate import QualityGate
from ai_validator.models import RunReport
from ai_validator.runner import ValidationRunner


def test_golden_dataset_has_cases():
    cases = get_golden_dataset()
    assert len(cases) >= 5
    assert all(tc.question and tc.expected_answer for tc in cases)


def test_retriever_returns_relevant_docs():
    retriever = SimpleRetriever()
    contexts = retriever.retrieve("What is RAG?", top_k=2)
    assert len(contexts) >= 1
    assert any("RAG" in ctx or "Retrieval" in ctx for ctx in contexts)


def test_rag_pipeline_mock_mode():
    pipeline = RAGPipeline()
    result = pipeline.query("What metrics does Ragas provide?")
    assert result.answer
    assert len(result.retrieved_contexts) >= 1


def test_mock_evaluator_scores():
    pipeline = RAGPipeline()
    evaluator = MockEvaluator()
    test_case = get_golden_dataset()[0]
    run = pipeline.run_test_case(test_case)
    evaluation = evaluator.evaluate_one(run, test_case)

    assert evaluation.test_case_id == test_case.id
    assert len(evaluation.metrics) == 3
    assert all(0 <= m.score <= 1 for m in evaluation.metrics)


def test_quality_gate_passes_on_good_scores():
    from ai_validator.models import EvaluationResult, MetricScore

    report = RunReport(
        run_id="test",
        mode="mock",
        results=[
            EvaluationResult(
                test_case_id="tc-001",
                metrics=[
                    MetricScore(name="faithfulness", score=0.9, passed=True),
                    MetricScore(name="answer_relevancy", score=0.85, passed=True),
                    MetricScore(name="context_precision", score=0.8, passed=True),
                ],
            )
        ],
    )
    gate = QualityGate()
    result = gate.check(report)
    assert result.passed


def test_full_runner_mock_mode():
    runner = ValidationRunner()
    report = runner.run(evaluator_backend="mock")
    assert report.run_id
    assert len(report.results) == len(get_golden_dataset())
    assert report.gate_passed is True
