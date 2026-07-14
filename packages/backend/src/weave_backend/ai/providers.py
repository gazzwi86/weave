"""Provider implementations for the same tier-routed model call (AC-4).
Real SDK/HTTP clients (`boto3`, `anthropic`, `httpx`) are only ever
constructed lazily and never invoked in tests — every test passes its own
mock `client=`.
"""

from __future__ import annotations

import json
import os
from typing import Any, Protocol

import httpx


class ModelProvider(Protocol):
    def complete(self, model_id: str, prompt: str, **kwargs: object) -> str: ...


class AnthropicProvider:
    """Calls Claude directly via the Anthropic SDK (never Bedrock)."""

    def __init__(self, client: Any | None = None) -> None:
        if client is None:
            import anthropic

            client = anthropic.Anthropic()
        self._client = client

    def complete(self, model_id: str, prompt: str, **kwargs: Any) -> str:
        max_tokens = kwargs.pop("max_tokens", 1024)
        response = self._client.messages.create(
            model=model_id,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )
        return str(response.content[0].text)


class BedrockProvider:
    """Calls Claude via AWS Bedrock Runtime (`invoke_model`)."""

    def __init__(self, client: Any | None = None) -> None:
        if client is None:
            import boto3

            # boto3 raises NoRegionError if no region is resolvable from the
            # environment/config -- which is exactly the case in CI (and any
            # bare shell). Fall back to a default so constructing the provider
            # never needs ambient AWS config; a real deploy sets AWS_REGION.
            region = (
                os.environ.get("AWS_REGION")
                or os.environ.get("AWS_DEFAULT_REGION")
                or "us-east-1"
            )
            client = boto3.client("bedrock-runtime", region_name=region)
        self._client = client

    def complete(self, model_id: str, prompt: str, **kwargs: Any) -> str:
        max_tokens = kwargs.pop("max_tokens", 1024)
        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
                **kwargs,
            }
        )
        response = self._client.invoke_model(modelId=model_id, body=body)
        payload = json.loads(response["body"].read())
        return str(payload["content"][0]["text"])


class OllamaProvider:
    """Calls a host-native Ollama HTTP API (ADR-011: Ollama runs on the dev
    host, never in docker-compose -- no GPU passthrough into containers on
    Apple-Silicon macOS). Dev-only NL query provider; `model_id` (a Claude
    tier id from `ai/config.py`) is ignored -- Ollama always uses whichever
    local model `OLLAMA_MODEL` names.
    """

    def __init__(self, client: httpx.Client | None = None, *, model: str | None = None) -> None:
        self._model = model or os.environ.get("OLLAMA_MODEL", "batiai/qwen3.6-27b:iq3")
        if client is None:
            base_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
            # Local models routinely take >30s on long completions (spec
            # drafting) -- a too-tight client timeout surfaces as a crashed
            # pipeline, not a clean failure. Env-tunable for slower hosts.
            timeout_s = float(os.environ.get("OLLAMA_TIMEOUT_S", "120"))
            client = httpx.Client(base_url=base_url, timeout=timeout_s)
        self._client = client

    def complete(self, model_id: str, prompt: str, **kwargs: Any) -> str:
        del model_id  # Ollama's model is OLLAMA_MODEL, not the Claude tier id
        response = self._client.post(
            "/api/generate",
            json={"model": self._model, "prompt": prompt, "stream": False, **kwargs},
        )
        response.raise_for_status()
        return str(response.json()["response"])


#: CE-V1-TASK-019 (AC-008-04, Law F): a deterministic single-candidate
#: extraction result, shaped to satisfy `document_extractor.py`'s
#: `_ExtractionResult`/CE-WRITE-1 `Op` schemas, used when no
#: `WEAVE_FIXTURE_RESPONSE` override is set.
_DEFAULT_FIXTURE_RESPONSE = json.dumps(
    {
        "candidates": [
            {
                "kind": "Process",
                "label": "Customer Onboarding",
                "confidence": 0.91,
                "span": "Runbook > Customer Onboarding",
                "reason": "e2e fixture",
                "ops": [
                    {
                        "op": "add_node",
                        "ref": "n1",
                        "kind": "Process",
                        "label": "Customer Onboarding",
                    }
                ],
            }
        ]
    }
)


class FixtureProvider:
    """Never calls a real model (Law F). Returns `WEAVE_FIXTURE_RESPONSE`
    verbatim if set, else a canned single-candidate extraction result --
    deterministic and prompt-independent, so a Playwright E2E can drive the
    real ingest pipeline (real DB, real CE-WRITE-1 commit) without a live
    LLM call. `WEAVE_MODEL_PROVIDER=fixture` opts in; never the default.
    """

    def __init__(self) -> None:
        self._client = "fixture"  # sentinel, no real client to construct

    def complete(self, model_id: str, prompt: str, **kwargs: Any) -> str:
        del model_id, prompt, kwargs
        return os.environ.get("WEAVE_FIXTURE_RESPONSE", _DEFAULT_FIXTURE_RESPONSE)
