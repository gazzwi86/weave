"""TASK-003 (ADR-005, FR-051, EPIC-011) integration tests: investigator
summary persistence (AC-6) and tenant isolation (AC-7) against real
Postgres. `dep_summaries` has no FK on `project_iri` (migration 0012), so
no project row needs seeding -- same precedent as `test_self_verify_
handoff.py`'s direct-DB style, minus the orchestrator round trip (this
task's AC surface is `dispatch_investigator` + the summary store, not a
run-lifecycle route).
"""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

import pytest

from weave_backend.build.investigator import (
    InvestigatorRequest,
    InvestigatorResult,
    dispatch_investigator,
    list_investigation_summaries,
)
from weave_backend.db.pool import tenant_connection

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_RAW_SUBGRAPH = "RAW SUBGRAPH CONTENT " * 200  # stands in for what must never leak out


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


async def _stub_agent_run(**_kwargs: object) -> InvestigatorResult:
    return InvestigatorResult(
        pointer=f"urn:weave:pointer:{uuid.uuid4().hex}", summary=_RAW_SUBGRAPH
    )


async def test_should_return_summary_not_raw_subgraph(platform_stack: Path) -> None:
    tenant_id = _unique_tenant("tenant-investigator")
    project_iri = f"urn:weave:tenant:{tenant_id}:project:acme"
    request = InvestigatorRequest(
        tenant_id=tenant_id,
        project_iri=project_iri,
        question="what feeds into the onboarding process?",
        caller_is_investigator=False,
    )

    async with tenant_connection(tenant_id) as conn:
        summary = await dispatch_investigator(conn, request, agent_run_fn=_stub_agent_run)

        rows = await list_investigation_summaries(
            conn, tenant_id=tenant_id, project_iri=project_iri
        )

    # AC-6: caller gets only the (truncated) summary, never the raw
    # subgraph -- and the persisted row carries no raw-subgraph field.
    assert summary == _RAW_SUBGRAPH  # under the 500-token cap, untruncated
    assert len(rows) == 1
    assert rows[0]["summary"] == _RAW_SUBGRAPH
    assert set(rows[0]) == {"kind", "pointer", "summary"}


async def test_should_return_zero_tenant_a_rows_for_tenant_b_investigator(
    platform_stack: Path,
) -> None:
    tenant_a = _unique_tenant("tenant-a")
    tenant_b = _unique_tenant("tenant-b")
    project_iri = "urn:weave:tenant:shared-slug:project:acme"  # same slug, different tenants

    request_a = InvestigatorRequest(
        tenant_id=tenant_a,
        project_iri=project_iri,
        question="tenant A's question",
        caller_is_investigator=False,
    )
    async with tenant_connection(tenant_a) as conn:
        await dispatch_investigator(conn, request_a, agent_run_fn=_stub_agent_run)

    async with tenant_connection(tenant_b) as conn:
        rows = await list_investigation_summaries(
            conn, tenant_id=tenant_b, project_iri=project_iri
        )

    assert rows == []
