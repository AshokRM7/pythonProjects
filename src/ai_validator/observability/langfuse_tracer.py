"""Langfuse integration — trace runs and push evaluation scores."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Generator

from ai_validator.config import Settings, get_settings
from ai_validator.models import EvaluationResult, RAGRunResult


class LangfuseTracer:
    """Optional observability layer. No-op when Langfuse keys are missing."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._client = None

        if self.settings.langfuse_enabled:
            from langfuse import Langfuse

            self._client = Langfuse(
                public_key=self.settings.langfuse_public_key,
                secret_key=self.settings.langfuse_secret_key,
                host=self.settings.langfuse_host,
            )

    @property
    def enabled(self) -> bool:
        return self._client is not None

    @contextmanager
    def trace_rag_query(
        self,
        question: str,
        metadata: dict[str, Any] | None = None,
    ) -> Generator[Any, None, None]:
        if not self._client:
            yield None
            return

        trace = self._client.trace(
            name="rag-query",
            input={"question": question},
            metadata=metadata or {},
        )
        try:
            yield trace
        finally:
            self._client.flush()

    def log_run_result(self, trace: Any, run_result: RAGRunResult) -> None:
        if trace is None:
            return
        trace.update(
            output={
                "answer": run_result.answer,
                "contexts": run_result.retrieved_contexts,
                "latency_ms": run_result.latency_ms,
            }
        )

    def log_evaluation_scores(
        self,
        trace: Any,
        evaluation: EvaluationResult,
    ) -> None:
        if trace is None or self._client is None:
            return

        for metric in evaluation.metrics:
            self._client.score(
                trace_id=trace.id,
                name=metric.name,
                value=metric.score,
                comment=metric.reason,
            )

    def flush(self) -> None:
        if self._client:
            self._client.flush()
