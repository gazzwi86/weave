"""AC-4: routes a (tier, prompt) call to the right model via the configured
provider. ``WEAVE_MODEL_PROVIDER=bedrock|anthropic`` selects the provider;
callers may also inject one directly (tests always do — Law F, no live
Bedrock/Anthropic calls).
"""

from __future__ import annotations

import os

from weave_backend.ai.config import MODEL_ROUTING_TABLE
from weave_backend.ai.providers import AnthropicProvider, BedrockProvider, ModelProvider


def _select_provider() -> ModelProvider:
    if os.environ.get("WEAVE_MODEL_PROVIDER") == "bedrock":
        return BedrockProvider()
    return AnthropicProvider()


def route(
    tier: str, prompt: str, *, provider: ModelProvider | None = None, **kwargs: object
) -> str:
    if tier not in MODEL_ROUTING_TABLE:
        raise ValueError(f"unknown model tier: {tier!r}")
    model_id = MODEL_ROUTING_TABLE[tier]
    active_provider = provider or _select_provider()
    return active_provider.complete(model_id, prompt, **kwargs)
