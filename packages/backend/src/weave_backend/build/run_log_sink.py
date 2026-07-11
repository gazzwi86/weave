"""BE-V1-TASK-018 AC-1: the run-log sink. M1's orchestrator only emits
Python `logging` -- nothing about a run is persisted (task brief). This
sink buffers the same PDAC/gate/retry event payloads already being logged
and, at run end, writes them as NDJSON to S3 and points
`generation_runs.log_location_ref` at the object (the Console tab's
finished-run source, AC-4).

Design Decisions (task brief): a sink failure is a disclosed warning, never
a run failure -- same posture as the cost-event insert (TASK-012 AC-6). The
key convention (`tenant/{tenant_id}/runs/{run_id}/run.ndjson`) reuses
`storage/tenant_objects.py`'s tenant-prefix isolation discipline so a
future real-S3 swap needs no key-shape change.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import asyncpg
from botocore.exceptions import BotoCoreError, ClientError

log = logging.getLogger(__name__)


def _run_log_key(tenant_id: str, run_id: str) -> str:
    return f"tenant/{tenant_id}/runs/{run_id}/run.ndjson"


class RunLogSink:
    """Constructed per run beside the existing Audit + Billing Emitter call
    sites in the PDAC loop (Implementation Hints) -- `emit` buffers, `close`
    persists once at run end (any terminal status).
    """

    def __init__(self, *, tenant_id: str, run_id: str, s3_client: Any, bucket: str) -> None:
        self._tenant_id = tenant_id
        self._run_id = run_id
        self._s3_client = s3_client
        self._bucket = bucket
        self._buffer: list[str] = []

    def emit(self, event: dict[str, Any]) -> None:
        self._buffer.append(json.dumps(event))

    async def close(self, conn: asyncpg.Connection) -> None:
        """AC-1: write the buffered NDJSON to S3 then point
        `generation_runs.log_location_ref` at it. A put failure is logged
        and swallowed -- no DB write happens, and the run itself is never
        failed by a sink problem.
        """
        key = _run_log_key(self._tenant_id, self._run_id)
        body = "\n".join(self._buffer).encode()
        try:
            self._s3_client.put_object(Bucket=self._bucket, Key=key, Body=body)
        except (BotoCoreError, ClientError):
            log.warning(
                "run_log_persist_failed",
                extra={"tenant_id": self._tenant_id, "run_id": self._run_id},
            )
            return

        location_ref = f"s3://{self._bucket}/{key}"
        # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
        await conn.execute(
            "UPDATE generation_runs SET log_location_ref = $1"
            " WHERE tenant_id = $2 AND run_id = $3",
            location_ref,
            self._tenant_id,
            self._run_id,
        )
