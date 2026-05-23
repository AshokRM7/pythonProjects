"""DeepEval evaluator — pytest-friendly LLM test cases."""

from __future__ import annotations

from ai_validator.config import Settings, get_settings
from ai_validator.evaluators.base import BaseEvaluator
from ai_validator.models import EvaluationResult, MetricScore, RAGRunResult, RAGTestCase


class DeepEvalEvaluator(BaseEvaluator):
    name = "deepeval"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def evaluate_one(
        self,
        run_result: RAGRunResult,
        test_case: RAGTestCase,
    ) -> EvaluationResult:
        from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric
        from deepeval.test_case import LLMTestCase

        llm_test_case = LLMTestCase(
            input=run_result.question,
            actual_output=run_result.answer,
            expected_output=test_case.expected_answer,
            retrieval_context=run_result.retrieved_contexts,
        )

        faithfulness_metric = FaithfulnessMetric(threshold=self.settings.gate_faithfulness_min)
        relevancy_metric = AnswerRelevancyMetric(
            threshold=self.settings.gate_answer_relevancy_min
        )

        faithfulness_metric.measure(llm_test_case)
        relevancy_metric.measure(llm_test_case)

        metrics = [
            MetricScore(
                name="faithfulness",
                score=round(float(faithfulness_metric.score or 0), 3),
                reason=getattr(faithfulness_metric, "reason", "") or "DeepEval faithfulness",
                passed=bool(faithfulness_metric.is_successful()),
            ),
            MetricScore(
                name="answer_relevancy",
                score=round(float(relevancy_metric.score or 0), 3),
                reason=getattr(relevancy_metric, "reason", "") or "DeepEval answer relevancy",
                passed=bool(relevancy_metric.is_successful()),
            ),
        ]

        return EvaluationResult(test_case_id=test_case.id, metrics=metrics)
