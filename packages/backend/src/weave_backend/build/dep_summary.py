"""AC-4/AC-5: dependency-summary handoff store (BE-TASK-006, build-engine
EPIC-011), tenant-scoped and keyed by `(project_iri, task_id)` -- task ids
are not guaranteed unique across tenants/projects, so `task_id` alone would
risk a cross-tenant collision (Implementation Hints). Migration 0012.
"""

from __future__ import annotations

import json
from typing import Any

import asyncpg
from pydantic import BaseModel, Field


class DepSummary(BaseModel):
    task_id: str
    decisions: list[str] = Field(default_factory=list)
    edge_cases: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)


async def write_dep_summary(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, summary: DepSummary
) -> None:
    """AC-4: upsert -- a retried CODIFY for the same task overwrites its own
    summary rather than erroring on a duplicate key.
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        """
        INSERT INTO dep_summaries (project_iri, task_id, tenant_id, content)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (project_iri, task_id, tenant_id) DO UPDATE SET content = EXCLUDED.content
        """,
        project_iri,
        summary.task_id,
        tenant_id,
        json.dumps(summary.model_dump()),
    )


async def get_dep_summary(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, task_id: str
) -> DepSummary | None:
    """AC-5: best-effort predecessor lookup -- a miss is the caller's
    signal to log `missing_handoff` and dispatch anyway (M1 never holds).
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        "SELECT content FROM dep_summaries"
        " WHERE tenant_id = $1 AND project_iri = $2 AND task_id = $3",
        tenant_id,
        project_iri,
        task_id,
    )
    if row is None:
        return None
    content = row["content"]
    parsed: dict[str, Any] = json.loads(content) if isinstance(content, str) else content
    return DepSummary.model_validate(parsed)


async def dep_summary_exists(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, task_id: str
) -> bool:
    summary = await get_dep_summary(
        conn, tenant_id=tenant_id, project_iri=project_iri, task_id=task_id
    )
    return summary is not None
