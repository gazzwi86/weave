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


@dataclass(frozen=True)
class GenerationRun:
    """BE-TASK-009: the persisted row the deploy flow looks up by
    `commit_sha` to find the `run_id` it publishes an artefact under.

    `deploy_sequence`/`feature_flags` (TASK-009 migration `0021`, ADR-020):
    per-run release-plan inputs -- nullable, population deferred (see ADR).
    """

    run_id: str
    project_iri: str
    task_id: str
    branch: str
    commit_sha: str
    deploy_sequence: list[str] | None = None
    feature_flags: list[str] | None = None


async def get_generation_run_by_commit_sha(
    conn: asyncpg.Connection, *, tenant_id: str, commit_sha: str
) -> GenerationRun | None:
    row = await conn.fetchrow(
        """
        SELECT run_id, project_iri, task_id, branch, commit_sha
        FROM generation_runs
        WHERE tenant_id = $1 AND commit_sha = $2
        ORDER BY created_at DESC
        LIMIT 1
        """,
        tenant_id,
        commit_sha,
    )
    if row is None:
        return None
    return GenerationRun(
        run_id=str(row["run_id"]),
        project_iri=row["project_iri"],
        task_id=row["task_id"],
        branch=row["branch"],
        commit_sha=row["commit_sha"],
    )
