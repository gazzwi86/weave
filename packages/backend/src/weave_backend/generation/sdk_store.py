"""BE-V1-TASK-005 (BE-SDK-1 delivery): `generation_runs` persistence for
the `run_kind = 'sdk'` lifecycle (migration `0031_generation_runs_sdk_lifecycle.sql`,
ADR-022) -- reuses the M1 app-gen table (task brief: "reuse generation_runs,
no new table") rather than duplicating a sibling table; sibling module to
`generation/store.py` (which owns the `run_kind IS NULL` app-gen rows and is
untouched by this task).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import asyncpg

#: Implementation Hints: 409 is "already `queued|running|breaking_hold`" --
#: `passed`/`failed` are terminal, a new trigger is always allowed after them.
IN_FLIGHT_STATUSES = frozenset({"queued", "running", "breaking_hold"})


@dataclass(frozen=True)
class SdkGenerationRun:
    run_id: str
    project_iri: str
    status: str
    payload: dict[str, Any]


def _row_to_run(row: asyncpg.Record) -> SdkGenerationRun:
    return SdkGenerationRun(
        run_id=str(row["run_id"]),
        project_iri=row["project_iri"],
        status=row["status"],
        payload=json.loads(row["payload"]),
    )


async def insert_sdk_generation_run(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> SdkGenerationRun:
    """AC-1: enqueue a new `queued` SDK run. `task_id` is a required NOT
    NULL column on `generation_runs` but has no meaning for an SDK run (no
    PDAC task backs it) -- filled with a descriptive placeholder, never read
    back.
    """
    row = await conn.fetchrow(
        """
        INSERT INTO generation_runs (tenant_id, project_iri, task_id, status, run_kind)
        VALUES ($1, $2, 'sdk-generation', 'queued', 'sdk')
        RETURNING run_id, project_iri, status, payload
        """,
        tenant_id,
        project_iri,
    )
    return _row_to_run(row)


async def lock_latest_sdk_run(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> SdkGenerationRun | None:
    """AC-1's 409 check (Implementation Hints: "SELECT ... FOR UPDATE on the
    newest generation row, not an advisory flag") -- locks the newest `sdk`
    run for this project so two concurrent triggers serialise: the second
    request's `FOR UPDATE` blocks until the first's insert transaction
    commits, then it re-reads and correctly sees the just-inserted row.
    """
    row = await conn.fetchrow(
        """
        SELECT run_id, project_iri, status, payload
        FROM generation_runs
        WHERE tenant_id = $1 AND project_iri = $2 AND run_kind = 'sdk'
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
        """,
        tenant_id,
        project_iri,
    )
    return _row_to_run(row) if row is not None else None


async def get_sdk_run(
    conn: asyncpg.Connection, *, tenant_id: str, run_id: str
) -> SdkGenerationRun | None:
    row = await conn.fetchrow(
        """
        SELECT run_id, project_iri, status, payload
        FROM generation_runs
        WHERE tenant_id = $1 AND run_id = $2 AND run_kind = 'sdk'
        """,
        tenant_id,
        run_id,
    )
    return _row_to_run(row) if row is not None else None


async def get_latest_sdk_run(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> SdkGenerationRun | None:
    """AC-7: `GET .../sdk-generations/latest`."""
    row = await conn.fetchrow(
        """
        SELECT run_id, project_iri, status, payload
        FROM generation_runs
        WHERE tenant_id = $1 AND project_iri = $2 AND run_kind = 'sdk'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        tenant_id,
        project_iri,
    )
    return _row_to_run(row) if row is not None else None


async def ensure_sdk_run(
    conn: asyncpg.Connection, *, tenant_id: str, run_id: str, project_iri: str
) -> None:
    """`_generate_and_commit` (sdk_trigger.py) can run against a `run_id`
    that was never inserted via `insert_sdk_generation_run` (`run_sdk_generation`
    called directly, skipping the trigger route's own insert) -- idempotent
    insert-or-noop so the later `update_sdk_run_status` UPDATE always has a
    row to land on. `ON CONFLICT (run_id) DO NOTHING` never clobbers an
    already-`breaking_hold` row on the ack-resume path.
    """
    await conn.execute(
        """
        INSERT INTO generation_runs (tenant_id, run_id, project_iri, task_id, status, run_kind)
        VALUES ($1, $2, $3, 'sdk-generation', 'running', 'sdk')
        ON CONFLICT (run_id) DO NOTHING
        """,
        tenant_id,
        run_id,
        project_iri,
    )


async def update_sdk_run_status(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    run_id: str,
    status: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Law E (max 5 params): no separate `commit_sha` param -- a commit SHA
    is just another `payload` key (`payload={"commit_sha": ..., ...}`), same
    as `package_version`/`breaking_hold` below.
    """
    await conn.execute(
        """
        UPDATE generation_runs
        SET status = $1, payload = $2::jsonb
        WHERE tenant_id = $3 AND run_id = $4 AND run_kind = 'sdk'
        """,
        status,
        json.dumps(payload or {}),
        tenant_id,
        run_id,
    )
