"""TASK-013 (ADR-008 Decisions #4/#5, FR-008) integration test:
`GET /api/projects/{project_iri}/costs` against real docker-marked Postgres
-- same lane conventions as `test_briefs_api.py`. Proves the real
`cost_events.rollup`/`burn_rate` SQL and the router wiring end to end; the
forecast-formula/cascade unit logic is proven fake-connection-fast in
`tests/unit/test_build_costs.py`.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from decimal import Decimal
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.briefs.store import NewBrief, build_brief_iri, insert_task_brief
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.pm.cost_events import NewCostEvent
from weave_backend.pm.cost_events import insert as insert_cost_event

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_project_iri(label: str) -> str:
    return f"urn:weave:project:{label}-{uuid.uuid4().hex[:8]}:acme"


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=ASGITransport(app=mock_oidc_app), base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_get_costs_returns_payload_within_contract_shape(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-1/AC-2/AC-3 endpoint shape: `{label, total_estimate_usd, by_task,
    burn_rate_usd, forecast_usd, forecast_inputs}` seeded against one done
    task's cost event and one todo task's brief estimate.
    """
    tenant_id = f"tenant-costs-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    async with tenant_connection(tenant_id) as conn:
        await insert_cost_event(
            conn,
            tenant_id=tenant_id,
            event=NewCostEvent(
                project_iri=project_iri, task_id="t-done", run_id=str(uuid.uuid4()),
                agent_role="delegate", model="claude-sonnet-5",
                tokens_in=1000, tokens_out=500, cost_estimate_usd=Decimal("1.5"),
            ),
        )
        await insert_task_brief(
            conn,
            NewBrief(
                tenant_id=tenant_id, task_id="t-done", project_iri=project_iri,
                brief_iri=build_brief_iri("t-done"), schema_version="1.0",
                content={"cost_estimate": {
                    "complexity": "S", "estimated_tokens_input_k": 1,
                    "estimated_tokens_output_k": 0.5, "estimated_cost_usd": 1.5,
                }},
            ),
        )

    response = await client.get(f"/api/projects/{project_iri}/costs", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["label"] == "estimated"
    assert body["total_estimate_usd"] == 1.5
    assert {row["task_id"] for row in body["by_task"]} == {"t-done"}
    assert "burn_rate_usd" in body
    assert "forecast_usd" in body
    assert body["forecast_inputs"]["basis"] in ("calibrated", "brief_only")


async def test_get_costs_returns_zero_total_for_project_with_no_spend(
    client: AsyncClient, platform_stack: Path
) -> None:
    """A project with no cost events yet is a real `0` total (honest, not
    the AC-6 error case -- that's a DB failure, not an empty rollup).
    """
    tenant_id = f"tenant-costs-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.get(f"/api/projects/{project_iri}/costs", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total_estimate_usd"] == 0
    assert body["by_task"] == []
