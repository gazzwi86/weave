"""CE-V1-TASK-014 AC-003-02/-08: embed-on-ingest-commit orchestration --
chunk -> assert index model -> embed -> put vectors -> write passages.jsonl.
Fetch/store I/O is injected (Law F: no live S3/Bedrock in unit tests).
"""

from __future__ import annotations

from weave_backend.corpus.pipeline import embed_and_index_artefact
from weave_backend.corpus.vectors import VectorIndex


class _StubEmbedder:
    def embed(self, model_id: str, texts: list[str]) -> list[list[float]]:
        del model_id
        return [[float(len(t)), 0.0] for t in texts]


def test_should_chunk_embed_and_index_a_committed_artefact() -> None:
    index = VectorIndex()
    written: list[tuple[str, bytes]] = []

    embed_and_index_artefact(
        content=b"# Heading\nsome short passage text",
        ext="md",
        tenant_id="tenant-a",
        artefact_iri="urn:weave:instances:artefact-1",
        artefact_hash="hash1",
        embedder=_StubEmbedder(),
        model_id="titan-v2",
        dims=2,
        index=index,
        write_passages_jsonl=lambda tenant_id, artefact_hash, lines: written.append(
            (tenant_id, b"\n".join(lines))
        ),
    )

    results = index.query("tenant-a", [1.0, 0.0], k=10)
    assert len(results) >= 1
    assert results[0].meta["artefact_iri"] == "urn:weave:instances:artefact-1"
    assert written and written[0][0] == "tenant-a"


def test_should_degrade_gracefully_when_notation_chunking_unavailable() -> None:
    """AC-003-01 seam: an XML artefact returns no passages (honest
    unavailable) instead of raising out of the commit path.
    """
    index = VectorIndex()

    embed_and_index_artefact(
        content=b"<xml/>",
        ext="xml",
        tenant_id="tenant-a",
        artefact_iri="urn:weave:instances:artefact-2",
        artefact_hash="hash2",
        embedder=_StubEmbedder(),
        model_id="titan-v2",
        dims=2,
        index=index,
        write_passages_jsonl=lambda *a, **k: None,
    )

    assert index.query("tenant-a", [1.0, 0.0], k=10) == []


def _embed_v3(index: VectorIndex, content: bytes) -> None:
    embed_and_index_artefact(
        content=content,
        ext="md",
        tenant_id="tenant-a",
        artefact_iri="urn:weave:instances:artefact-3",
        artefact_hash="hash3",
        embedder=_StubEmbedder(),
        model_id="titan-v2",
        dims=2,
        index=index,
        write_passages_jsonl=lambda *a, **k: None,
    )


def test_should_replace_existing_passages_on_re_ingest() -> None:
    index = VectorIndex()
    _embed_v3(index, b"# H\nfirst version text")
    before = len(index.query("tenant-a", [1.0, 0.0], k=100))

    _embed_v3(index, b"# H\nfirst version text, re-ingested")
    after = index.query("tenant-a", [1.0, 0.0], k=100)

    assert len(after) == before  # same locator/id, replaced not duplicated
