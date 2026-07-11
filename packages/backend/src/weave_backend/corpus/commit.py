"""CE-V1-TASK-014 AC-003-02/-08: S3-wiring glue for the accept route's
background embed-on-commit call. Fetches the artefact's original bytes
(already written by `ingest/routers.py`'s upload route), then delegates to
`pipeline.embed_and_index_artefact`. Kept separate from `pipeline.py` so
that module stays pure/injectable (Law F) while this one owns the real
boto3 clients + default index singleton.
"""

from __future__ import annotations

import logging
import os

from weave_backend.corpus.embeddings import (
    DEFAULT_DIMENSIONS,
    DEFAULT_EMBEDDING_MODEL_ID,
    bedrock_client,
    embed_texts,
)
from weave_backend.corpus.pipeline import embed_and_index_artefact
from weave_backend.corpus.vectors import default_index
from weave_backend.ingest.corpus import corpus_bucket
from weave_backend.storage.tenant_objects import s3_client

log = logging.getLogger(__name__)


class _BedrockEmbedder:
    def embed(self, model_id: str, texts: list[str]) -> list[list[float]]:
        return embed_texts(bedrock_client(), model_id=model_id, texts=texts)


def _passages_key(corpus_key: str) -> str:
    # corpus_key is "{tenant_id}/{artefact_hash}/original.{ext}" (ingest/corpus.py)
    tenant_id, artefact_hash, _original = corpus_key.split("/", 2)
    return f"{tenant_id}/{artefact_hash}/passages.jsonl"


def embed_artefact_on_commit(*, tenant_id: str, artefact_iri: str, corpus_key: str) -> None:
    """Best-effort: a chunk/embed failure must not surface to the caller --
    this runs as a `BackgroundTasks` job after the accept response is
    already sent (implementation hint: citations/embedding stay additive).
    """
    try:
        _run(tenant_id=tenant_id, artefact_iri=artefact_iri, corpus_key=corpus_key)
    except Exception:
        log.warning("corpus: embed-on-commit failed for %s", artefact_iri, exc_info=True)


def _run(*, tenant_id: str, artefact_iri: str, corpus_key: str) -> None:
    bucket = corpus_bucket(os.environ.get("WEAVE_ENV", "dev"))
    obj = s3_client().get_object(Bucket=bucket, Key=corpus_key)
    content = obj["Body"].read()
    _tenant_id, artefact_hash, original = corpus_key.split("/", 2)
    ext = original.rsplit(".", 1)[-1]

    def _write_passages_jsonl(tenant_id: str, artefact_hash: str, lines: list[bytes]) -> None:
        s3_client().put_object(
            Bucket=bucket, Key=_passages_key(corpus_key), Body=b"\n".join(lines)
        )

    embed_and_index_artefact(
        content=content,
        ext=ext,
        tenant_id=tenant_id,
        artefact_iri=artefact_iri,
        artefact_hash=artefact_hash,
        embedder=_BedrockEmbedder(),
        model_id=DEFAULT_EMBEDDING_MODEL_ID,
        dims=DEFAULT_DIMENSIONS,
        index=default_index(),
        write_passages_jsonl=_write_passages_jsonl,
    )
