"""BE-TASK-009: publish the generated app bundle to durable S3 storage
(AC-1). Mirrors `audit/diff_storage.py`'s `_ensure_bucket_sync` /
`asyncio.to_thread` wrapping around the shared `storage/tenant_objects`
S3 client -- Law F: a fake client double stands in for unit tests, real
LocalStack only in integration.
"""

from __future__ import annotations

import asyncio
from typing import Any

from weave_backend.storage.tenant_objects import put_object, s3_client

ARTEFACT_BUCKET = "weave-artefacts"


class PublishError(Exception):
    """Raised when the S3 put (or bucket-ensure) fails for any reason."""


def _ensure_bucket_sync(client: Any) -> None:
    existing = {b["Name"] for b in client.list_buckets().get("Buckets", [])}
    if ARTEFACT_BUCKET not in existing:
        client.create_bucket(Bucket=ARTEFACT_BUCKET)


def _publish_sync(commit_sha: str, tenant_id: str, run_id: str) -> str:
    client = s3_client()
    _ensure_bucket_sync(client)
    key = f"{tenant_id}/{run_id}/"
    put_object(client, ARTEFACT_BUCKET, key, commit_sha.encode())
    return f"s3://{ARTEFACT_BUCKET}/{key}"


async def publish(commit_sha: str, tenant_id: str, run_id: str) -> str:
    """Uploads the bundle for `run_id` and returns its durable S3 URI.

    Raises `PublishError` on any S3 failure (AC-2 -- the caller degrades
    to a `publish_status: failed` response rather than propagating this).
    """
    try:
        return await asyncio.to_thread(_publish_sync, commit_sha, tenant_id, run_id)
    except Exception as exc:
        raise PublishError(str(exc)) from exc
