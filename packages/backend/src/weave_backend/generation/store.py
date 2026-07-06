"""BE-TASK-008: persistence for `generation_runs` (migration
`0015_generation_runs.sql`). One row per successful `generate_app` call --
gate outcomes are stored inline as JSONB (no separate `gate_results` table,
see migration's header comment for why).
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import asyncpg


@dataclass(frozen=True)
class NewGenerationRun:
    project_iri: str
    task_id: str
    gate_results: list[dict[str, object]]
    branch: str
    commit_sha: str


async def insert_generation_run(
    conn: asyncpg.Connection, *, tenant_id: str, run: NewGenerationRun
) -> None:
    await conn.execute(
        """
        INSERT INTO generation_runs
            (tenant_id, project_iri, task_id, status, gate_results, branch, commit_sha)
        VALUES ($1, $2, $3, 'passed', $4, $5, $6)
        """,
        tenant_id,
        run.project_iri,
        run.task_id,
        json.dumps(run.gate_results),
        run.branch,
        run.commit_sha,
    )
