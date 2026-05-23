"""Shared data models used across the validation pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class RAGTestCase:
    """One row in your golden evaluation dataset."""

    id: str
    question: str
    expected_answer: str
    expected_contexts: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)


@dataclass
class RAGRunResult:
    """Output from running your AI app on one test case."""

    test_case_id: str
    question: str
    answer: str
    retrieved_contexts: list[str]
    latency_ms: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class MetricScore:
    name: str
    score: float
    reason: str = ""
    passed: bool = True


@dataclass
class EvaluationResult:
    """Aggregated scores for one test case or a full run."""

    test_case_id: str
    metrics: list[MetricScore]
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @property
    def average_score(self) -> float:
        if not self.metrics:
            return 0.0
        if len(self.metrics) == 1:
            return self.metrics[0].score
        return sum(m.score for m in self.metrics) / len(self.metrics)

    def get(self, name: str) -> MetricScore | None:
        for m in self.metrics:
            if m.name == name:
                return m
        return None


@dataclass
class RunReport:
    """Full evaluation report across all test cases."""

    run_id: str
    mode: str  # "mock" | "live"
    results: list[EvaluationResult]
    pipeline_results: list[RAGRunResult] = field(default_factory=list)
    gate_passed: bool = True
    gate_failures: list[str] = field(default_factory=list)

    def aggregate(self, metric_name: str) -> float:
        scores = [
            r.get(metric_name).score
            for r in self.results
            if r.get(metric_name) is not None
        ]
        return sum(scores) / len(scores) if scores else 0.0
