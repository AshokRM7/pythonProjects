"""Central configuration — single place for env vars and thresholds."""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str = Field(default="mock", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")

    langfuse_public_key: str | None = Field(default=None, alias="LANGFUSE_PUBLIC_KEY")
    langfuse_secret_key: str | None = Field(default=None, alias="LANGFUSE_SECRET_KEY")
    langfuse_host: str = Field(
        default="https://cloud.langfuse.com", alias="LANGFUSE_HOST"
    )

    gate_faithfulness_min: float = Field(default=0.70, alias="GATE_FAITHFULNESS_MIN")
    gate_answer_relevancy_min: float = Field(
        default=0.70, alias="GATE_ANSWER_RELEVANCY_MIN"
    )
    gate_context_precision_min: float = Field(
        default=0.60, alias="GATE_CONTEXT_PRECISION_MIN"
    )

    @property
    def is_mock_mode(self) -> bool:
        return self.openai_api_key.lower() in ("mock", "test", "none", "")

    @property
    def langfuse_enabled(self) -> bool:
        return bool(self.langfuse_public_key and self.langfuse_secret_key)


def get_settings() -> Settings:
    return Settings()
