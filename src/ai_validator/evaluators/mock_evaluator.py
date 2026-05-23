"""Mock evaluator — teaches metric concepts without API calls."""

from __future__ import annotations

import re

from ai_validator.config import Settings, get_settings
from ai_validator.evaluators.base import BaseEvaluator
from ai_validator.models import EvaluationResult, MetricScore, RAGRunResult, RAGTestCase


def _token_set(text: str) -> set[str]:
    return set(re.findall(r"\w+", text.lower()))


def _overlap_score(a: str, b: str) -> float:
    b_tokens = _token_set(b)
    if not b_tokens:
        return 0.0
    return len(_token_set(a) & b_tokens) / len(b_tokens)


class MockEvaluator(BaseEvaluator):
    """
    Rule-based stand-in for Ragas/DeepEval in mock mode.

    Scores approximate real metrics so you can learn the pipeline flow:
    - faithfulness: answer tokens found in retrieved context
    - answer_relevancy: answer tokens overlap with question
    - context_precision: retrieved context overlap with expected contexts
  """

    name = "mock"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def evaluate_one(
        self,
        run_result: RAGRunResult,
        test_case: RAGTestCase,
    ) -> EvaluationResult:
        metrics: list[MetricScore] = []

        # Faithfulness: are answer claims supported by retrieved context?
        context_text = " ".join(run_result.retrieved_contexts)
        answer_tokens = _token_set(run_result.answer)
        context_tokens = _token_set(context_text)
        faithfulness = (
            len(answer_tokens & context_tokens) / len(answer_tokens)
            if answer_tokens
            else 0.0
        )
        metrics.append(
            MetricScore(
                name="faithfulness",
                score=round(min(faithfulness, 1.0), 3),
                reason="Token overlap between answer and retrieved context",
                passed=faithfulness >= self.settings.gate_faithfulness_min,
            )
        )

        # Answer: answer addresses the question?
        relevancy = _overlap_score(run_result.answer, run_result.question)
        metrics.append(
            MetricScore(
                name="answer_relevancy",
                score=round(min(relevancy + 0.3, 1.0), 3),
                reason="Token overlap between answer and question",
                passed=relevancy + 0.3 >= self.settings.gate_answer_relevancy_min,
            )
        )

        # Context precision: did retriever fetch relevant docs?
        expected = " ".join(test_case.expected_contexts)
        retrieved = " ".join(run_result.retrieved_contexts)
        precision = _overlap_score(retrieved, expected) if expected else 0.5
        metrics.append(
            MetricScore(
                name="context_precision",
                score=round(min(precision + 0.2, 1.0), 3),
                reason="Retrieved context overlap with expected context",
                passed=precision + 0.2 >= self.settings.gate_context_precision_min,
            )
        )

        return EvaluationResult(test_case_id=test_case.id, metrics=metrics)
