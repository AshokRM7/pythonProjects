"""Quality gates — CI/CD pass/fail decisions based on metric thresholds."""

from __future__ import annotations

from dataclasses import dataclass

from ai_validator.config import Settings, get_settings
from ai_validator.models import RunReport


@dataclass
class GateResult:
    passed: bool
    failures: list[str]
    summary: dict[str, float]


class QualityGate:
    """
    Aggregates evaluation scores and enforces minimum thresholds.

    This is what you wire into GitHub Actions / Jenkins to block bad deploys.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def check(self, report: RunReport) -> GateResult:
        thresholds = {
            "faithfulness": self.settings.gate_faithfulness_min,
            "answer_relevancy": self.settings.gate_answer_relevancy_min,
            "context_precision": self.settings.gate_context_precision_min,
        }

        summary: dict[str, float] = {}
        failures: list[str] = []

        for metric_name, threshold in thresholds.items():
            avg = report.aggregate(metric_name)
            if avg > 0:
                summary[metric_name] = round(avg, 3)
                if avg < threshold:
                    failures.append(
                        f"{metric_name}: {avg:.3f} < threshold {threshold:.3f}"
                    )

        return GateResult(
            passed=len(failures) == 0,
            failures=failures,
            summary=summary,
        )
