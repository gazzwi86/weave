"""Runtime configuration, sourced from environment variables / .env."""

from __future__ import annotations

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings. WEAVE_* environment variables override defaults."""

    model_config = SettingsConfigDict(
        env_prefix="WEAVE_",
        env_file=".env",
        extra="ignore",
    )

    data_dir: str = "./data"
    seed_demo: bool = True
    cors_origins: str = "http://localhost:5173"

    # Accept the conventionally un-prefixed ANTHROPIC_API_KEY as well as WEAVE_*.
    anthropic_api_key: str = Field(
        "",
        validation_alias=AliasChoices("WEAVE_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"),
    )
    llm_model: str = "claude-sonnet-4-6"

    # Ollama (optional): when set, the LLM service routes to Ollama instead of Anthropic.
    # Recommended for local dev: ollama run qwen2.5-coder:32b
    ollama_url: str = Field("", description="Ollama base URL, e.g. http://localhost:11434")
    ollama_model: str = Field("qwen2.5-coder:14b", description="Ollama model name.")
    ollama_context_window: int = Field(32768, description="num_ctx for Ollama requests.")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


def get_settings() -> Settings:
    """Build settings (a small DI seam for FastAPI dependencies and tests)."""
    return Settings()
