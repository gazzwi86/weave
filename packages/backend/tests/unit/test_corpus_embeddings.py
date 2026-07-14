"""CE-V1-TASK-014 AC-003-02: Titan v2 embed call, mocked (Law F -- never a
live Bedrock call in tests, mirrors `ai/providers.py`'s own test contract).
"""

from __future__ import annotations

from weave_backend.corpus.embeddings import (
    DEFAULT_DIMENSIONS,
    DEFAULT_EMBEDDING_MODEL_ID,
    embed_texts,
)


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def invoke_model(self, *, modelId: str, body: str) -> dict[str, object]:
        import json
        from io import BytesIO

        payload = json.loads(body)
        self.calls.append({"modelId": modelId, "inputText": payload["inputText"]})
        vector = [0.1] * DEFAULT_DIMENSIONS
        return {"body": BytesIO(json.dumps({"embedding": vector}).encode())}


def test_should_embed_each_text_with_the_given_model_id() -> None:
    client = _StubClient()

    vectors = embed_texts(client, model_id=DEFAULT_EMBEDDING_MODEL_ID, texts=["hello", "world"])

    assert len(vectors) == 2
    assert all(len(v) == DEFAULT_DIMENSIONS for v in vectors)
    assert [c["modelId"] for c in client.calls] == [DEFAULT_EMBEDDING_MODEL_ID] * 2
    assert [c["inputText"] for c in client.calls] == ["hello", "world"]
