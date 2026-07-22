"""Application configuration loaded from environment / .env file."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "CrediSight - Bank Statement Analyzer"
    debug: bool = False

    database_url: str = f"sqlite:///{BASE_DIR / 'credisight.db'}"
    upload_dir: Path = BASE_DIR / "uploads"

    # LLM (optional). Set OPENAI_API_KEY in backend/.env to enable.
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    llm_enabled_features: str = "classification,narrative"  # comma separated

    # Analysis thresholds
    high_value_txn_threshold: float = 100000.0  # absolute high-value alert
    cash_intensity_warn_ratio: float = 0.40     # cash txns vs total inflow
    foir_max: float = 0.55                      # max Fixed Obligation to Income Ratio
    min_salary_occurrences: int = 2

    @property
    def llm_available(self) -> bool:
        return bool(self.openai_api_key.strip())

    @property
    def llm_features(self) -> set[str]:
        return {f.strip() for f in self.llm_enabled_features.split(",") if f.strip()}


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.upload_dir.mkdir(parents=True, exist_ok=True)
    return s
