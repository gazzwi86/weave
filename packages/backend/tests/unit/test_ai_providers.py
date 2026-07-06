"""AC-4: provider selection reads WEAVE_MODEL_PROVIDER and never calls a real
Bedrock, Anthropic, or Ollama endpoint in tests (Law F) — every HTTP/SDK
client is mocked.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock

import httpx
import pytest

from weave_backend.ai.providers import AnthropicProvider, BedrockProvider, OllamaProvider
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
    assert kwargs == {
        "model": "claude-sonnet-5",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": "hello"}],
    }
    assert result == "hi there"


def test_anthropic_provider_passes_through_custom_max_tokens_and_kwargs() -> None:
    fake_client = MagicMock()
    fake_client.messages.create.return_value = MagicMock(content=[MagicMock(text="x")])
    provider = AnthropicProvider(client=fake_client)

    provider.complete("claude-sonnet-5", "hello", max_tokens=42, temperature=0.7)

    _, kwargs = fake_client.messages.create.call_args
    assert kwargs["max_tokens"] == 42
    assert kwargs["temperature"] == 0.7


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
    assert json.loads(kwargs["body"]) == {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": "hello"}],
    }
    assert result == "hi from bedrock"


def test_bedrock_provider_passes_through_extra_kwargs_in_body() -> None:
    fake_client = MagicMock()
    fake_client.invoke_model.return_value = {
        "body": MagicMock(read=lambda: b'{"content": [{"text": "x"}]}')
    }
    provider = BedrockProvider(client=fake_client)

    provider.complete("claude-sonnet-5", "hello", top_p=0.9)

    _, kwargs = fake_client.invoke_model.call_args
    body = json.loads(kwargs["body"])
    assert body["top_p"] == 0.9
    assert body["messages"] == [{"role": "user", "content": "hello"}]


def test_ollama_provider_calls_generate_endpoint() -> None:
    fake_client = MagicMock()
    fake_client.post.return_value = MagicMock(json=lambda: {"response": "hi from ollama"})
    provider = OllamaProvider(client=fake_client, model="gemma4:e4b")

    result = provider.complete("claude-sonnet-5", "hello")

    fake_client.post.assert_called_once_with(
        "/api/generate",
        json={"model": "gemma4:e4b", "prompt": "hello", "stream": False},
    )
    fake_client.post.return_value.raise_for_status.assert_called_once()
    assert result == "hi from ollama"


def test_ollama_provider_passes_through_extra_kwargs() -> None:
    fake_client = MagicMock()
    fake_client.post.return_value = MagicMock(json=lambda: {"response": "x"})
    provider = OllamaProvider(client=fake_client, model="gemma4:e4b")

    provider.complete("claude-sonnet-5", "hello", temperature=0.2)

    _, kwargs = fake_client.post.call_args
    assert kwargs["json"]["temperature"] == 0.2


def test_ollama_provider_reads_model_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OLLAMA_MODEL", "qwen3.6:27b-q4_K_M")
    fake_client = MagicMock()
    fake_client.post.return_value = MagicMock(json=lambda: {"response": "x"})
    provider = OllamaProvider(client=fake_client)

    provider.complete("claude-sonnet-5", "hello")

    assert fake_client.post.call_args.kwargs["json"]["model"] == "qwen3.6:27b-q4_K_M"


def test_ollama_provider_propagates_connection_errors() -> None:
    """Host Ollama unreachable -- raises, doesn't swallow. Graceful
    degradation is `nl_query/translator.py`'s job, not the provider's."""
    fake_client = MagicMock()
    fake_client.post.side_effect = httpx.ConnectError("refused")
    provider = OllamaProvider(client=fake_client)

    with pytest.raises(httpx.ConnectError):
        provider.complete("claude-sonnet-5", "hello")


@pytest.mark.parametrize(
    ("env_value", "expected_type"),
    [
        ("bedrock", BedrockProvider),
        ("anthropic", AnthropicProvider),
        ("ollama", OllamaProvider),
        (None, AnthropicProvider),
    ],
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
    assert isinstance(provider, (AnthropicProvider, BedrockProvider, OllamaProvider))
    assert provider._client is not None
