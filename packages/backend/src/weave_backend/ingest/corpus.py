"""AC-001-01: S3 corpus key layout for `POST /api/ingest/artefacts`.

`s3://weave-corpus-{env}/{tenant_id}/{artefact_hash}/original.{ext}` --
pure key-building, reuses `storage.tenant_objects.s3_client()`/`put_object()`
for the actual write (no new S3 client wiring here).
"""

from __future__ import annotations

import hashlib

#: First 16 hex chars of the content sha256 -- short enough for a readable
#: key, long enough that a collision within one tenant is not a real risk.
HASH_PREFIX_LEN = 16


def corpus_bucket(env: str) -> str:
    return f"weave-corpus-{env}"


def corpus_key(*, tenant_id: str, artefact_hash: str, ext: str) -> str:
    return f"{tenant_id}/{artefact_hash}/original.{ext}"


def hash_content(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()[:HASH_PREFIX_LEN]
