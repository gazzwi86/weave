"""CE-V1-TASK-014 AC-003-02/-08: embed-on-ingest-commit orchestration.
Called from `routers/ingest.py`'s accept route as a background task -- chunk
-> assert index model (pin 2a) -> embed -> put vectors -> write
`passages.jsonl`. All I/O (embed client, index, S3 writer) is injected so
this stays synchronous and unit-testable (Law F).
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from typing import Protocol

from weave_backend.corpus.chunking import NotationChunkingUnavailable, chunk_artefact
from weave_backend.corpus.vectors import VectorIndex

log = logging.getLogger(__name__)


class Embedder(Protocol):
    def embed(self, model_id: str, texts: list[str]) -> list[list[float]]: ...


def embed_and_index_artefact(  # noqa: PLR0913 -- Law E waiver: pure orchestration,
    # every parameter is an independently-injected collaborator (Law F seam),
    # not groupable without a config object nothing else needs.
    *,
    content: bytes,
    ext: str,
    tenant_id: str,
    artefact_iri: str,
    artefact_hash: str,
    embedder: Embedder,
    model_id: str,
    dims: int,
    index: VectorIndex,
    write_passages_jsonl: Callable[[str, str, list[bytes]], None],
) -> None:
    try:
        passages = chunk_artefact(content, ext=ext, artefact_hash=artefact_hash)
    except NotationChunkingUnavailable:
        # AC-003-01 seam: honest degraded state, not a fatal commit error --
        # the artefact is retained, just not yet searchable (pending TASK-015).
        log.info("corpus: XML chunking unavailable for %s, skipping embed", artefact_iri)
        return

    index.ensure_index(tenant_id, model_id=model_id, dims=dims)
    vectors = embedder.embed(model_id, [p.text for p in passages])

    lines = []
    for passage, vector in zip(passages, vectors, strict=True):
        meta: dict[str, object] = {
            "artefact_iri": artefact_iri,
            "locator": passage.locator,
            "text": passage.text,
        }
        index.put(tenant_id, passage.id, vector, meta=meta)
        row = {"id": passage.id, "locator": passage.locator, "text": passage.text}
        lines.append(json.dumps(row).encode())
    write_passages_jsonl(tenant_id, artefact_hash, lines)
