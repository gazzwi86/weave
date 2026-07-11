"""CE-V1-TASK-014 AC-003-02: Titan v2 embeddings via Bedrock Runtime.

Mirrors `ai/providers.py::BedrockProvider` -- the real `boto3` client is
only ever constructed lazily and never invoked in tests (Law F).
"""

from __future__ import annotations

import json
import os
from typing import Any

#: ADR-011 pin 2a default -- the tenant index metadata records whichever
#: model was actually used; this is the value a fresh index is created with.
DEFAULT_EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0"
DEFAULT_DIMENSIONS = 1024


def bedrock_client() -> Any:
    import boto3

    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"
    return boto3.client("bedrock-runtime", region_name=region)


def embed_texts(client: Any, *, model_id: str, texts: list[str]) -> list[list[float]]:
    """One `invoke_model` call per text -- Titan's embed API is single-input;
    batching would need a different model family, out of scope (ADR-011).
    """
    vectors = []
    for text in texts:
        response = client.invoke_model(
            modelId=model_id, body=json.dumps({"inputText": text})
        )
        payload = json.loads(response["body"].read())
        vectors.append(payload["embedding"])
    return vectors
