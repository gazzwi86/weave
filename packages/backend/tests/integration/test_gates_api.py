"""BE-TASK-007 (build-engine EPIC-012) integration tests: DoR/DoD gate
result persistence against the real docker-marked stack (Postgres + RLS +
`PLAT-AUDIT-1`) -- same lane conventions as `test_briefs_api.py`.

The DoD gate's own `DOD_COMMANDS` (`ruff`/`mypy --strict`/`pytest --cov`/
`mutmut run`/`bandit`) are heavy, whole-repo operations -- patched at the
`gates.qa_agent.run_command` module boundary here (same precedent as
`test_briefs_api.py` patching `draft_brief_document` to avoid a real LLM
call, Law F). `tests/unit/test_qa_agent.py` proves `run_command` itself
genuinely shells out against real binaries.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.briefs.store import (
    NewBrief,
    build_brief_iri,
    generate_task_id,
    insert_task_brief,
)
from weave_backend.build import store as task_store
from weave_backend.build.qa_agent import CommandOutcome
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_project_iri(label: str) -> str:
    return f"urn:weave:project:{label}-{uuid.uuid4().hex[:8]}:acme"


def _valid_brief_content(project_iri: str, task_id: str) -> dict[str, object]:
    return {
        "schema_version": "1.0",
        "task_id": task_id,
        "project_iri": project_iri,
        "title": "Do the thing",
        "user_story": "As a user I want the thing so that value",
        "acceptance_criteria": [
            {"id": "AC-1", "criterion": "WHEN X THE SYSTEM SHALL Y", "test_mapping": "test_x"}
        ],
        "ac_to_test_map": [{"ac_id": "AC-1", "test_name": "test_x"}],
        "dor_checklist": ["User story clear"],
        "dod_checklist": ["All AC met"],
        "dep_chain": {"blocked_by": [], "unlocks": []},
        "cost_estimate": {
            "complexity": "S",
            "estimated_tokens_input_k": 1,
            "estimated_tokens_output_k": 1,
            "estimated_cost_usd": 0.1,
        },
        "generated_at": "2026-07-04T00:00:00Z",
        # BE-TASK-002's `TaskBrief` schema has no `design_decisions` field
        # yet (a cross-task gap -- see this task's final report); the DoR
        # gate reads whatever key is in the stored JSONB, so it's seeded
        # directly here rather than through `create_brief_route`.
        "design_decisions": [{"decision": "Use X", "reference": "ADR-1"}],
    }


async def _seed_brief(tenant_id: str, project_iri: str, content: dict[str, object]) -> str:
    task_id = generate_task_id(project_iri, str(content["title"]))
    async with tenant_connection(tenant_id) as conn:
        await insert_task_brief(
            conn,
            NewBrief(
                tenant_id=tenant_id,
                task_id=task_id,
                project_iri=project_iri,
                brief_iri=build_brief_iri(task_id),
                schema_version="1.0",
                content=content,
            ),
        )
    return task_id


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_task_store() -> None:
    task_store.reset_for_tests()


async def test_dor_gate_records_result_to_audit_on_ready(client: AsyncClient) -> None:
    tenant_id = f"tenant-gates-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")
    content = _valid_brief_content(project_iri, "task-dor-ready")
    task_id = await _seed_brief(tenant_id, project_iri, content)
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.post(f"/api/tasks/{task_id}/gates/dor", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"gate": "DoR", "result": "READY"}

    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT event_type, diff_summary FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'gate_result_dor'",
            tenant_id,
        )
    assert len(rows) == 1


async def test_dor_gate_holds_task_in_ready_when_not_ready(client: AsyncClient) -> None:
    tenant_id = f"tenant-gates-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")
    content = _valid_brief_content(project_iri, "task-dor-not-ready")
    del content["design_decisions"]
    task_id = await _seed_brief(tenant_id, project_iri, content)
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.post(f"/api/tasks/{task_id}/gates/dor", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "NOT_READY"
    assert body["failing_checks"] == ["design_decisions"]

    held_task = task_store.get_task(tenant_id, task_id)
    assert held_task is not None
    assert held_task.status == "Ready"


async def test_dod_gate_records_result_to_audit_on_fail_with_command_details(
    client: AsyncClient,
) -> None:
    tenant_id = f"tenant-gates-{uuid.uuid4().hex[:8]}"
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    def _fake_run_command(cmd: str) -> CommandOutcome:
        if "ruff" in cmd:
            return CommandOutcome(status="FAIL", evidence="lint error")
        return CommandOutcome(status="PASS")

    with patch(
        "weave_backend.build.gates.qa_agent.run_command", side_effect=_fake_run_command
    ):
        response = await client.post(
            "/api/tasks/task-dod-fail/gates/dod", headers=headers
        )

    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "FAIL"
    lint_result = next(c for c in body["commands"] if c["name"] == "lint")
    assert lint_result["status"] == "FAIL"

    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT event_type, diff_summary FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'gate_result_dod'",
            tenant_id,
        )
    assert len(rows) == 1
    assert rows[0]["diff_summary"] is not None


# --- QA edge cases ---------------------------------------------------------
#
# The brief's own Integration Test Requirements (minimum 3) don't name a
# pre-scaffold HTTP-route test, and none of the 3 delivered integration
# tests exercise `POST /api/projects/{project_iri}/gates/pre-scaffold` --
# only the unit-level `run_pre_scaffold_gate` callable is proven (bypassing
# routing/auth/DB wiring entirely). AC-5/AC-6 and the "audit write ordered
# before response" design decision are unverified for this gate's actual
# wire path. Closing that gap here.


async def test_pre_scaffold_gate_route_persists_and_blocks_on_critical_gap(
    client: AsyncClient,
) -> None:
    tenant_id = f"tenant-gates-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")
    task_store.upsert_project_spec(tenant_id, project_iri, brief_present=True, prd_present=True)
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.post(
        f"/api/projects/{project_iri}/gates/pre-scaffold", headers=headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "BLOCKED"
    assert body["failing_step"] == "roadmap"
    failing_steps = {finding["step"] for finding in body["findings"]}
    assert failing_steps == {"roadmap", "tech_spec", "impl_ready"}

    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT event_type, diff_summary FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'gate_result_pre_scaffold'",
            tenant_id,
        )
    assert len(rows) == 1
    assert rows[0]["diff_summary"] is not None


async def test_gate_results_rls_tenant_isolation(client: AsyncClient) -> None:
    """`gate_results` has the same FORCE ROW LEVEL SECURITY precedent as
    `task_briefs` (0010) -- `test_brief_store_rls_tenant_isolation` proves
    that table's isolation, but nothing proved it for `gate_results` before
    this test. A tenant must never see another tenant's gate rows.
    """
    tenant_a = f"tenant-gates-a-{uuid.uuid4().hex[:8]}"
    tenant_b = f"tenant-gates-b-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")
    task_store.upsert_project_spec(tenant_a, project_iri, brief_present=True)
    tokens_a = await issue_token_pair(sub="u-a", tenant_id=tenant_a)

    response = await client.post(
        f"/api/projects/{project_iri}/gates/pre-scaffold",
        headers={"Authorization": f"Bearer {tokens_a.access_token}"},
    )
    assert response.status_code == 200

    async with tenant_connection(tenant_b) as conn:
        rows = await conn.fetch("SELECT id FROM gate_results")
    assert rows == []
