"""Base evaluator interface — all evaluators implement this contract."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ai_validator.models import EvaluationResult, RAGRunResult, RAGTestCase


class BaseEvaluator(ABC):
    name: str = "base"

    @abstractmethod
    def evaluate_one(
        self,
        run_result: RAGRunResult,
        test_case: RAGTestCase,
    ) -> EvaluationResult:
        """Score a single pipeline run against its golden test case."""

    def evaluate_batch(
        self,
        run_results: list[RAGRunResult],
        test_cases: list[RAGTestCase],
    ) -> list[EvaluationResult]:
        case_map = {tc.id: tc for tc in test_cases}
        results: list[EvaluationResult] = []
        for run in run_results:
            test_case = case_map.get(run.test_case_id)
            if test_case is None:
                continue
            results.append(self.evaluate_one(run, test_case))
        return results
