"""AC-4: provider selection reads WEAVE_MODEL_PROVIDER and never calls a real
Bedrock or Anthropic endpoint in tests (Law F) — both SDK clients are mocked.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from weave_backend.ai.providers import AnthropicProvider, BedrockProvider
from weave_backend.ai.router import _select_provider


def test_anthropic_provider_calls_messages_create() -> None:
    fake_client = MagicMock()
    fake_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="hi there")]
    )
    provider = AnthropicProvider(client=fake_client)

    result = provider.complete("claude-sonnet-5", "hello")

    fake_client.messages.create.assert_called_once()
    _, kwargs = fake_client.messages.create.call_args
    assert kwargs["model"] == "claude-sonnet-5"
    assert result == "hi there"


def test_bedrock_provider_calls_invoke_model() -> None:
    fake_client = MagicMock()
    fake_client.invoke_model.return_value = {
        "body": MagicMock(
            read=lambda: b'{"content": [{"text": "hi from bedrock"}]}'
        )
    }
    provider = BedrockProvider(client=fake_client)

    result = provider.complete("claude-sonnet-5", "hello")

    fake_client.invoke_model.assert_called_once()
    _, kwargs = fake_client.invoke_model.call_args
    assert kwargs["modelId"] == "claude-sonnet-5"
    assert result == "hi from bedrock"


@pytest.mark.parametrize(
    ("env_value", "expected_type"),
    [("bedrock", BedrockProvider), ("anthropic", AnthropicProvider), (None, AnthropicProvider)],
)
def test_select_provider_reads_env(
    monkeypatch: pytest.MonkeyPatch, env_value: str | None, expected_type: type
) -> None:
    if env_value is None:
        monkeypatch.delenv("WEAVE_MODEL_PROVIDER", raising=False)
    else:
        monkeypatch.setenv("WEAVE_MODEL_PROVIDER", env_value)

    provider = _select_provider()

    assert isinstance(provider, expected_type)
