"""CE-V1-TASK-014 AC-003-02/-08: S3-wiring glue -- fetches an accepted
artefact's original bytes from the corpus bucket, chunks/embeds/indexes it,
and writes `passages.jsonl` back. Real S3/Bedrock clients are injected so
this stays Law-F-clean (no live cloud call in a unit test).
"""

from __future__ import annotations

from io import BytesIO

import pytest

from weave_backend.corpus import commit as commit_mod
from weave_backend.corpus.vectors import VectorIndex


class _StubS3:
    def __init__(self, body: bytes) -> None:
        self._body = body
        self.put_calls: list[tuple[str, str, bytes]] = []

    def get_object(self, *, Bucket: str, Key: str) -> dict[str, object]:
        del Bucket, Key
        return {"Body": BytesIO(self._body)}

    def put_object(self, *, Bucket: str, Key: str, Body: bytes) -> None:
        self.put_calls.append((Bucket, Key, Body))


class _StubBedrock:
    def invoke_model(self, *, modelId: str, body: str) -> dict[str, object]:
        del modelId, body
        import json

        return {"body": BytesIO(json.dumps({"embedding": [1.0, 0.0]}).encode())}


def test_should_fetch_chunk_embed_and_write_passages_for_a_committed_artefact(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    s3 = _StubS3(b"# H\nsome passage text here")
    index = VectorIndex()
    monkeypatch.setattr(commit_mod, "s3_client", lambda: s3)
    monkeypatch.setattr(commit_mod, "bedrock_client", lambda: _StubBedrock())
    monkeypatch.setattr(commit_mod, "default_index", lambda: index)

    commit_mod.embed_artefact_on_commit(
        tenant_id="tenant-a",
        artefact_iri="urn:weave:instances:artefact-1",
        corpus_key="tenant-a/hash1/original.md",
    )

    results = index.query("tenant-a", [1.0, 0.0], k=10)
    assert results
    assert s3.put_calls
    _bucket, key, _body = s3.put_calls[0]
    assert key == "tenant-a/hash1/passages.jsonl"
