"""Runtime LLM settings — configurable via the API without restart."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RuntimeSettings:
    provider: str = "anthropic"  # "anthropic" | "ollama"
    model: str = ""  # overrides config default if non-empty
    ollama_url: str = ""  # overrides WEAVE_OLLAMA_URL if non-empty


_runtime = RuntimeSettings()


def get_runtime() -> RuntimeSettings:
    return _runtime


def update_runtime(
    provider: str | None,
    model: str | None,
    ollama_url: str | None,
) -> RuntimeSettings:
    if provider is not None:
        _runtime.provider = provider
    if model is not None:
        _runtime.model = model
    if ollama_url is not None:
        _runtime.ollama_url = ollama_url
    return _runtime


def reset_runtime() -> None:
    """Reset all runtime settings to defaults (for test isolation)."""
    _runtime.provider = "anthropic"
    _runtime.model = ""
    _runtime.ollama_url = ""
