"""TASK-010: `project_prompts` repo layer (FR-065) -- free-text prompt runs.
`insert` records the prompt at submit time; `set_run_id` links it to the
`generation_runs` row once the async run is enqueued.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import asyncpg


@dataclass(frozen=True)
class Prompt:
    prompt_id: str
    project_iri: str
    principal_iri: str
    prompt_text: str
    run_id: str | None
    created_at: datetime


def _from_row(row: asyncpg.Record) -> Prompt:
    return Prompt(
        prompt_id=str(row["prompt_id"]),
        project_iri=row["project_iri"],
        principal_iri=row["principal_iri"],
        prompt_text=row["prompt_text"],
        run_id=str(row["run_id"]) if row["run_id"] is not None else None,
        created_at=row["created_at"],
    )


async def insert(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    project_iri: str,
    principal_iri: str,
    prompt_text: str,
) -> Prompt:
    """Record a submitted prompt. `run_id` is NULL until `set_run_id`."""
    row = await conn.fetchrow(
        """
        INSERT INTO project_prompts (tenant_id, project_iri, principal_iri, prompt_text)
        VALUES ($1, $2, $3, $4)
        RETURNING prompt_id, project_iri, principal_iri, prompt_text, run_id, created_at
        """,
        tenant_id,
        project_iri,
        principal_iri,
        prompt_text,
    )
    return _from_row(row)


async def set_run_id(
    conn: asyncpg.Connection, *, tenant_id: str, prompt_id: str, run_id: str
) -> None:
    """Link a prompt to the `generation_runs` row it enqueued."""
    await conn.execute(
        "UPDATE project_prompts SET run_id = $1 WHERE tenant_id = $2 AND prompt_id = $3",
        run_id,
        tenant_id,
        prompt_id,
    )


async def get_recent(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, limit: int = 20
) -> list[Prompt]:
    """Most recent prompts for a project, newest first."""
    rows = await conn.fetch(
        "SELECT prompt_id, project_iri, principal_iri, prompt_text, run_id, created_at"
        " FROM project_prompts WHERE tenant_id = $1 AND project_iri = $2"
        " ORDER BY created_at DESC LIMIT $3",
        tenant_id,
        project_iri,
        limit,
    )
    return [_from_row(row) for row in rows]
