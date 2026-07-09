"""TASK-010 (build-engine v1, EPIC-002) integration tests: the four new PM
tables (`project_contributors`, `external_bindings`, `cost_events`,
`project_prompts`, migration `0018_v1_pm_tables.sql`) against the real
docker-marked stack -- same lane conventions as `test_gates_api.py`.

No single reusable "extend the table list" isolation fixture exists in this
codebase (every isolation test hand-rolls its own tenant pair, e.g.
`test_gate_results_rls_tenant_isolation`) -- this file follows that same
per-file convention rather than inventing a new shared fixture.
"""

from __future__ import annotations

import shutil
import uuid
from decimal import Decimal
from pathlib import Path

import asyncpg
import pytest

from weave_backend.db.pool import tenant_connection, untenanted_connection
from weave_backend.generation.store import NewGenerationRun, insert_generation_run
from weave_backend.pm import bindings, contributors, cost_events, prompts

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_V1_PM_TABLES = ("project_contributors", "external_bindings", "cost_events", "project_prompts")


def _unique_tenant(label: str) -> str:
    return f"tenant-{label}-{uuid.uuid4().hex[:8]}"


def _unique_project_iri(label: str) -> str:
    return f"urn:weave:project:{label}-{uuid.uuid4().hex[:8]}:acme"


async def test_all_four_v1_tables_have_row_level_security_enabled_and_forced(
    platform_stack: Path,
) -> None:
    async with untenanted_connection() as conn:
        rows = await conn.fetch(
            "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class"
            " WHERE relname = ANY($1::text[])",
            list(_V1_PM_TABLES),
        )
    found = {row["relname"]: (row["relrowsecurity"], row["relforcerowsecurity"]) for row in rows}
    assert set(found) == set(_V1_PM_TABLES)
    assert all(enabled and forced for enabled, forced in found.values())


async def test_tenant_b_sees_zero_rows_across_all_four_v1_tables(platform_stack: Path) -> None:
    tenant_a = _unique_tenant("a")
    tenant_b = _unique_tenant("b")
    project_iri = _unique_project_iri("proj")

    async with tenant_connection(tenant_a) as conn:
        await contributors.upsert(
            conn,
            tenant_id=tenant_a,
            contributor=contributors.NewContributor(
                project_iri=project_iri,
                principal_iri="urn:weave:person:alice",
                role="admin",
                added_by="urn:weave:person:bob",
            ),
        )
        await bindings.put(
            conn,
            tenant_id=tenant_a,
            binding=bindings.NewBinding(
                project_iri=project_iri,
                system="jira",
                connector_ref="conn-1",
                space_ref="ACME",
                created_by="urn:weave:person:bob",
            ),
        )
        await cost_events.insert(
            conn,
            tenant_id=tenant_a,
            event=cost_events.NewCostEvent(
                project_iri=project_iri,
                task_id="task-1",
                run_id=None,
                agent_role="engineer",
                model="claude-sonnet-5",
                tokens_in=10,
                tokens_out=5,
                cost_estimate_usd=Decimal("0.001"),
            ),
        )
        await prompts.insert(
            conn,
            tenant_id=tenant_a,
            project_iri=project_iri,
            principal_iri="urn:weave:person:alice",
            prompt_text="add a login page",
        )

    async with tenant_connection(tenant_b) as conn:
        for table in _V1_PM_TABLES:
            rows = await conn.fetch(f"SELECT 1 FROM {table}")  # noqa: S608 -- fixed table name
            assert rows == [], f"tenant B saw rows in {table}"


async def test_generation_runs_trigger_and_log_location_ref_defaults(
    platform_stack: Path,
) -> None:
    tenant_id = _unique_tenant("gr")
    project_iri = _unique_project_iri("proj")
    commit_sha = f"sha-{uuid.uuid4().hex[:8]}"

    async with tenant_connection(tenant_id) as conn:
        await insert_generation_run(
            conn,
            tenant_id=tenant_id,
            run=NewGenerationRun(
                project_iri=project_iri,
                task_id="task-1",
                gate_results=[],
                branch="build/acme/task-1",
                commit_sha=commit_sha,
            ),
        )
        row = await conn.fetchrow(
            "SELECT trigger, log_location_ref FROM generation_runs"
            " WHERE tenant_id = $1 AND commit_sha = $2",
            tenant_id,
            commit_sha,
        )

    assert row is not None
    assert row["trigger"] == "request"
    assert row["log_location_ref"] is None


async def test_project_contributors_rejects_invalid_role_at_db_constraint(
    platform_stack: Path,
) -> None:
    tenant_id = _unique_tenant("role")
    project_iri = _unique_project_iri("proj")

    async with tenant_connection(tenant_id) as conn:
        with pytest.raises(asyncpg.CheckViolationError):
            await contributors.upsert(
                conn,
                tenant_id=tenant_id,
                contributor=contributors.NewContributor(
                    project_iri=project_iri,
                    principal_iri="urn:weave:person:alice",
                    role="reader",  # not modelled -- readers have no row (design decision)
                    added_by="urn:weave:person:bob",
                ),
            )


async def test_external_bindings_rejects_duplicate_binding_at_unique_constraint(
    platform_stack: Path,
) -> None:
    tenant_id = _unique_tenant("dup")
    project_iri = _unique_project_iri("proj")

    async with tenant_connection(tenant_id) as conn:
        await bindings.put(
            conn,
            tenant_id=tenant_id,
            binding=bindings.NewBinding(
                project_iri=project_iri,
                system="jira",
                connector_ref="conn-1",
                space_ref="ACME",
                created_by="urn:weave:person:bob",
            ),
        )
        with pytest.raises(asyncpg.UniqueViolationError):
            await bindings.put(
                conn,
                tenant_id=tenant_id,
                binding=bindings.NewBinding(
                    project_iri=project_iri,
                    system="jira",
                    connector_ref="conn-2",
                    space_ref="ACME",
                    created_by="urn:weave:person:bob",
                ),
            )


async def test_cost_events_rollup_computes_totals_and_by_task_from_seeded_events(
    platform_stack: Path,
) -> None:
    tenant_id = _unique_tenant("cost")
    project_iri = _unique_project_iri("proj")

    async def _seed(task_id: str | None, tokens_in: int, tokens_out: int, cost: str) -> None:
        async with tenant_connection(tenant_id) as conn:
            await cost_events.insert(
                conn,
                tenant_id=tenant_id,
                event=cost_events.NewCostEvent(
                    project_iri=project_iri,
                    task_id=task_id,
                    run_id=None,
                    agent_role="engineer",
                    model="claude-sonnet-5",
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    cost_estimate_usd=Decimal(cost),
                ),
            )

    await _seed("task-1", 100, 50, "0.01")
    await _seed("task-1", 20, 10, "0.002")
    await _seed("task-2", 5, 5, "0.001")
    await _seed(None, 1, 1, "0.0001")  # non-task work (drafting)

    async with tenant_connection(tenant_id) as conn:
        result = await cost_events.rollup(conn, tenant_id=tenant_id, project_iri=project_iri)

    assert result.total.tokens_in == 126
    assert result.total.tokens_out == 66
    assert result.total.cost_usd == Decimal("0.0131")
    by_task = {row.task_id: row for row in result.by_task}
    assert by_task["task-1"].tokens_in == 120
    assert by_task["task-2"].tokens_in == 5
    assert by_task[None].tokens_in == 1
