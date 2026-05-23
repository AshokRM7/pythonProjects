"""Ragas evaluator — research-backed RAG metrics."""

from __future__ import annotations

from ai_validator.config import Settings, get_settings
from ai_validator.evaluators.base import BaseEvaluator
from ai_validator.models import EvaluationResult, MetricScore, RAGRunResult, RAGTestCase


class RagasEvaluator(BaseEvaluator):
    name = "ragas"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def evaluate_one(
        self,
        run_result: RAGRunResult,
        test_case: RAGTestCase,
    ) -> EvaluationResult:
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import answer_relevancy, context_precision, faithfulness

        data = {
            "question": [run_result.question],
            "answer": [run_result.answer],
            "contexts": [run_result.retrieved_contexts or ["No context retrieved."]],
            "ground_truth": [test_case.expected_answer],
        }
        dataset = Dataset.from_dict(data)

        llm = None
        embeddings = None
        try:
            from langchain_openai import ChatOpenAI, OpenAIEmbeddings

            llm = ChatOpenAI(model=self.settings.openai_model)
            embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        except Exception:
            pass

        kwargs: dict = {"metrics": [faithfulness, answer_relevancy, context_precision]}
        if llm is not None:
            kwargs["llm"] = llm
        if embeddings is not None:
            kwargs["embeddings"] = embeddings

        result = evaluate(dataset, **kwargs)
        df = result.to_pandas()
        row = df.iloc[0]

        metrics: list[MetricScore] = []
        for metric_name, gate_attr in [
            ("faithfulness", "gate_faithfulness_min"),
            ("answer_relevancy", "gate_answer_relevancy_min"),
            ("context_precision", "gate_context_precision_min"),
        ]:
            if metric_name in row and row[metric_name] is not None:
                score = float(row[metric_name])
                threshold = getattr(self.settings, gate_attr)
                metrics.append(
                    MetricScore(
                        name=metric_name,
                        score=round(score, 3),
                        reason=f"Ragas {metric_name} (threshold: {threshold})",
                        passed=score >= threshold,
                    )
                )

        return EvaluationResult(test_case_id=test_case.id, metrics=metrics)

    def evaluate_batch(
        self,
        run_results: list[RAGRunResult],
        test_cases: list[RAGTestCase],
    ) -> list[EvaluationResult]:
        """Batch evaluation is more efficient for Ragas."""
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import answer_relevancy, context_precision, faithfulness

        case_map = {tc.id: tc for tc in test_cases}
        questions, answers, contexts, ground_truths, ids = [], [], [], [], []

        for run in run_results:
            tc = case_map.get(run.test_case_id)
            if tc is None:
                continue
            ids.append(run.test_case_id)
            questions.append(run.question)
            answers.append(run.answer)
            contexts.append(run.retrieved_contexts or ["No context retrieved."])
            ground_truths.append(tc.expected_answer)

        if not ids:
            return []

        dataset = Dataset.from_dict(
            {
                "question": questions,
                "answer": answers,
                "contexts": contexts,
                "ground_truth": ground_truths,
            }
        )

        llm = None
        embeddings = None
        try:
            from langchain_openai import ChatOpenAI, OpenAIEmbeddings

            llm = ChatOpenAI(model=self.settings.openai_model)
            embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        except Exception:
            pass

        kwargs: dict = {"metrics": [faithfulness, answer_relevancy, context_precision]}
        if llm is not None:
            kwargs["llm"] = llm
        if embeddings is not None:
            kwargs["embeddings"] = embeddings

        result = evaluate(dataset, **kwargs)
        df = result.to_pandas()

        results: list[EvaluationResult] = []
        for i, test_id in enumerate(ids):
            row = df.iloc[i]
            metrics: list[MetricScore] = []
            for metric_name, gate_attr in [
                ("faithfulness", "gate_faithfulness_min"),
                ("answer_relevancy", "gate_answer_relevancy_min"),
                ("context_precision", "gate_context_precision_min"),
            ]:
                if metric_name in row and row[metric_name] is not None:
                    score = float(row[metric_name])
                    threshold = getattr(self.settings, gate_attr)
                    metrics.append(
                        MetricScore(
                            name=metric_name,
                            score=round(score, 3),
                            reason=f"Ragas {metric_name}",
                            passed=score >= threshold,
                        )
                    )
            results.append(EvaluationResult(test_case_id=test_id, metrics=metrics))

        return results
