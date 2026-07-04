"""Two provider implementations for the same tier-routed model call (AC-4).
Real SDK clients (`boto3`, `anthropic`) are only ever constructed lazily and
never invoked in tests — every test passes its own mock `client=`.
"""

from __future__ import annotations

import json
import os
from typing import Any, Protocol


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
