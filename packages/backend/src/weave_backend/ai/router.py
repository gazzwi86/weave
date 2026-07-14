"""AC-4: routes a (tier, prompt) call to the right model via the configured
provider. ``WEAVE_MODEL_PROVIDER=bedrock|anthropic|ollama|fixture`` selects
the provider; callers may also inject one directly (tests always do — Law F,
no live Bedrock/Anthropic/Ollama calls). ``fixture`` (CE-V1-TASK-019) is
opt-in only, for deterministic E2E runs -- never the default.
"""

from __future__ import annotations

import os

from weave_backend.ai.config import MODEL_ROUTING_TABLE
from weave_backend.ai.providers import (
    AnthropicProvider,
    BedrockProvider,
    FixtureProvider,
    ModelProvider,
    OllamaProvider,
)


def _select_provider() -> ModelProvider:
    provider_name = os.environ.get("WEAVE_MODEL_PROVIDER")
    if provider_name == "bedrock":
        return BedrockProvider()
    if provider_name == "ollama":
        return OllamaProvider()
    if provider_name == "fixture":
        return FixtureProvider()
    return AnthropicProvider()


def route(
    tier: str, prompt: str, *, provider: ModelProvider | None = None, **kwargs: object
) -> str:
    if tier not in MODEL_ROUTING_TABLE:
        raise ValueError(f"unknown model tier: {tier!r}")
    model_id = MODEL_ROUTING_TABLE[tier]
    active_provider = provider or _select_provider()
    return active_provider.complete(model_id, prompt, **kwargs)
