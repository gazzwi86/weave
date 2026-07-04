"""Brief's diff_summary overflow rule: entries over 8 KB store the full
diff in S3 (LocalStack) and keep only the object key in `diff_summary`, so
no single audit row can blow past Postgres row-size sanity limits.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from weave_backend.storage.tenant_objects import put_object, s3_client, tenant_prefix

DIFF_SUMMARY_MAX_BYTES = 8 * 1024
AUDIT_DIFF_BUCKET = "weave-audit-diffs"


def _ensure_bucket_sync(client: Any) -> None:
    existing = {b["Name"] for b in client.list_buckets().get("Buckets", [])}
    if AUDIT_DIFF_BUCKET not in existing:
        client.create_bucket(Bucket=AUDIT_DIFF_BUCKET)


def _store_oversize_diff_sync(tenant_id: str, seq: int, diff_summary: dict[str, Any]) -> str:
    client = s3_client()
    _ensure_bucket_sync(client)
    key = f"{tenant_prefix(tenant_id)}audit/{seq}.json"
    put_object(client, AUDIT_DIFF_BUCKET, key, json.dumps(diff_summary).encode())
    return key


async def cap_diff_summary(
    tenant_id: str, seq: int, diff_summary: dict[str, Any] | None
) -> dict[str, Any] | None:
    """Returns `diff_summary` unchanged when it fits within the cap, or a
    `{"s3_key": ...}` pointer once the full diff has been uploaded.
    """
    if diff_summary is None:
        return None
    serialised = json.dumps(diff_summary)
    if len(serialised.encode()) <= DIFF_SUMMARY_MAX_BYTES:
        return diff_summary
    key = await asyncio.to_thread(_store_oversize_diff_sync, tenant_id, seq, diff_summary)
    return {"s3_key": key}
