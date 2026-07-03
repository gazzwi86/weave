"""AC-4: model-routing client maps tier -> model ID -> provider, with no model
ID hard-coded anywhere outside ``weave_backend.ai.config.MODEL_ROUTING_TABLE``.
"""

from __future__ import annotations

import pytest

from weave_backend.ai.config import MODEL_ROUTING_TABLE
from weave_backend.ai.router import route


class _RecordingProvider:
    """Fake provider that records the model id it was asked to run."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def complete(self, model_id: str, prompt: str, **_kwargs: object) -> str:
        self.calls.append((model_id, prompt))
        return f"echo:{model_id}"


@pytest.mark.parametrize("tier", ["fable", "sonnet"])
def test_model_routing_tier_mapping(tier: str) -> None:
    provider = _RecordingProvider()

    result = route(tier, "hello", provider=provider)

    expected_model = MODEL_ROUTING_TABLE[tier]
    assert provider.calls == [(expected_model, "hello")]
    assert result == f"echo:{expected_model}"


def test_route_rejects_unknown_tier() -> None:
    with pytest.raises(ValueError, match="unknown model tier"):
        route("opus", "hello", provider=_RecordingProvider())
