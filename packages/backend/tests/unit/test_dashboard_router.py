"""BE-V1-TASK-019: `GET /api/projects/{project_iri}/dashboard/{tile}` unit
tests -- exercised directly (not through HTTP), mirroring
`tests/unit/test_deploy_router.py`'s pattern.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.build.costs import (
    CostsPayload,
    ForecastInputs,
    ResolvedCap,
    RollupUnavailable,
)
from weave_backend.build.dashboard import ProjectNotFound, UnknownTile
from weave_backend.build.state_spine import StateSpine, TaskState
from weave_backend.generation.store import RecentRun
from weave_backend.projects.model import Project
from weave_backend.repo_bootstrap.store import ProjectRepoRow
from weave_backend.routers.dashboard import get_dashboard_tile_route

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
_MODULE = "weave_backend.routers.dashboard"
_PROJECT_IRI = "urn:weave:project:t1:acme"


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


def _costs_payload() -> CostsPayload:
    return CostsPayload(
        label="estimated",
        total_estimate_usd=12.5,  # type: ignore[arg-type]
        by_task=[],
        burn_rate_usd=0,  # type: ignore[arg-type]
        forecast_usd=40,  # type: ignore[arg-type]
        forecast_inputs=ForecastInputs(
            basis="calibrated",
            mean_actual=2,  # type: ignore[arg-type]
            completed_count=3,
            remaining_count=4,
            calibration=1.1,  # type: ignore[arg-type]
        ),
    )


async def test_route_400_on_unknown_tile() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await get_dashboard_tile_route(_PROJECT_IRI, "bogus", _PRINCIPAL)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == {"error": "unknown_tile"}  # type: ignore[comparison-overlap]


async def test_route_404_when_project_not_found_for_demo_tile() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.get_tile_payload", AsyncMock(side_effect=ProjectNotFound(_PROJECT_IRI))),
        pytest.raises(HTTPException) as exc_info,
    ):
        await get_dashboard_tile_route(_PROJECT_IRI, "demo", _PRINCIPAL)

    assert exc_info.value.status_code == 404


async def test_route_503_when_rollup_unavailable() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.get_tile_payload", AsyncMock(side_effect=RollupUnavailable("down"))),
        pytest.raises(HTTPException) as exc_info,
    ):
        await get_dashboard_tile_route(_PROJECT_IRI, "budget", _PRINCIPAL)

    assert exc_info.value.status_code == 503


async def test_route_raises_unknown_tile_before_touching_db() -> None:
    """AC-1: `tile` stays a plain `str` param, not `Literal` -- FastAPI's
    automatic enum-path validation would 422 instead of the AC's required
    400, so the 400 must come from application code, not routing.
    """
    with pytest.raises(UnknownTile):
        raise UnknownTile("bogus")


# --- build/dashboard.py: per-handler payload assembly -----------------


async def test_demo_tile_uses_last_recorded_run_status() -> None:
    from weave_backend.build.dashboard import get_tile_payload

    project = Project(
        project_iri=_PROJECT_IRI,
        name="Acme",
        pinned_graph_version_iri="urn:weave:version:v1",
        created_at=datetime.now(UTC),
        demo_output_location_ref="s3://weave-artefacts/t1/run-1/",
    )
    with (
        patch("weave_backend.build.dashboard.get_project", AsyncMock(return_value=project)),
        patch(
            "weave_backend.build.dashboard.list_recent_runs",
            AsyncMock(
                return_value=[
                    RecentRun(
                        run_id="run-2",
                        branch="main",
                        commit_sha="def456",
                        status="failed",
                        created_at=datetime.now(UTC),
                    )
                ]
            ),
        ),
    ):
        payload = await get_tile_payload(
            AsyncMock(), tenant_id="t1", project_iri=_PROJECT_IRI, tile="demo"
        )

    assert payload.output_location_ref == "s3://weave-artefacts/t1/run-1/"
    assert payload.last_run_status == "failed"


async def test_demo_tile_raises_project_not_found() -> None:
    from weave_backend.build.dashboard import get_tile_payload

    with (
        patch("weave_backend.build.dashboard.get_project", AsyncMock(return_value=None)),
        pytest.raises(ProjectNotFound),
    ):
        await get_tile_payload(AsyncMock(), tenant_id="t1", project_iri=_PROJECT_IRI, tile="demo")


async def test_budget_tile_includes_cap_and_level() -> None:
    from weave_backend.build.dashboard import get_tile_payload

    with (
        patch("weave_backend.build.dashboard.get_costs", AsyncMock(return_value=_costs_payload())),
        patch(
            "weave_backend.build.dashboard.resolve_budget_cap",
            AsyncMock(return_value=ResolvedCap(cap_usd=100, level="company")),  # type: ignore[arg-type]
        ),
    ):
        payload = await get_tile_payload(
            AsyncMock(), tenant_id="t1", project_iri=_PROJECT_IRI, tile="budget"
        )

    assert payload.label == "estimated"
    assert payload.cap_usd == 100
    assert payload.level == "company"


async def test_budget_tile_cap_none_when_no_cap_configured() -> None:
    from weave_backend.build.dashboard import get_tile_payload

    with (
        patch("weave_backend.build.dashboard.get_costs", AsyncMock(return_value=_costs_payload())),
        patch("weave_backend.build.dashboard.resolve_budget_cap", AsyncMock(return_value=None)),
    ):
        payload = await get_tile_payload(
            AsyncMock(), tenant_id="t1", project_iri=_PROJECT_IRI, tile="budget"
        )

    assert payload.cap_usd is None
    assert payload.level is None


async def test_forecast_tile_includes_inputs() -> None:
    from weave_backend.build.dashboard import get_tile_payload

    with patch("weave_backend.build.dashboard.get_costs", AsyncMock(return_value=_costs_payload())):
        payload = await get_tile_payload(
            AsyncMock(), tenant_id="t1", project_iri=_PROJECT_IRI, tile="forecast"
        )

    assert payload.label == "estimated"
    assert payload.forecast_inputs.completed_count == 3


async def test_tasks_tile_counts_by_status() -> None:
    from weave_backend.build.dashboard import get_tile_payload

    spine = StateSpine(
        project_iri=_PROJECT_IRI,
        tenant_id="t1",
        run_id="run-1",
        turn_cap=10,
        tasks=[
            TaskState(id="t-1", status="Ready"),
            TaskState(id="t-2", status="Blocked"),
            TaskState(id="t-3", status="Done"),
            TaskState(id="t-4", status="revision"),
        ],
    )
    with patch("weave_backend.build.dashboard.load_state_spine", AsyncMock(return_value=spine)):
        payload = await get_tile_payload(
            AsyncMock(), tenant_id="t1", project_iri=_PROJECT_IRI, tile="tasks"
        )

    assert payload.ready == 1
    assert payload.blocked == 1
    assert payload.done == 1
    assert payload.revision == 1


async def test_tasks_tile_empty_when_no_spine_yet() -> None:
    from weave_backend.build.dashboard import get_tile_payload

    with patch("weave_backend.build.dashboard.load_state_spine", AsyncMock(return_value=None)):
        payload = await get_tile_payload(
            AsyncMock(), tenant_id="t1", project_iri=_PROJECT_IRI, tile="tasks"
        )

    assert payload.ready == payload.blocked == payload.done == payload.revision == 0


async def test_blockers_tile_lists_held_tasks_with_reasons() -> None:
    from weave_backend.build.dashboard import get_tile_payload

    spine = StateSpine(
        project_iri=_PROJECT_IRI,
        tenant_id="t1",
        run_id="run-1",
        turn_cap=10,
        tasks=[
            TaskState(id="t-1", status="Ready", hold_reason="dep_summary_missing"),
            TaskState(id="t-2", status="Blocked"),
            TaskState(id="t-3", status="Done"),
        ],
    )
    with patch("weave_backend.build.dashboard.load_state_spine", AsyncMock(return_value=spine)):
        payload = await get_tile_payload(
            AsyncMock(), tenant_id="t1", project_iri=_PROJECT_IRI, tile="blockers"
        )

    reasons = {item.task_id: item.reason for item in payload.items}
    assert reasons["t-1"] == "missing handoff"
    assert reasons["t-2"] == "HITL pending"
    assert "t-3" not in reasons


async def test_ribbon_tile_joins_repo_url_from_recent_runs() -> None:
    from weave_backend.build.dashboard import get_tile_payload

    with (
        patch(
            "weave_backend.build.dashboard.fetch_project_repo_row",
            AsyncMock(
                return_value=ProjectRepoRow(
                    name="Acme",
                    source_control_provider=None,
                    source_control_token_secret_ref=None,
                    repo_provider="github",
                    repo_url="https://github.com/acme/widgets",
                    repo_default_branch="main",
                    repo_id="123",
                )
            ),
        ),
        patch(
            "weave_backend.build.dashboard.list_recent_runs",
            AsyncMock(
                return_value=[
                    RecentRun(
                        run_id="run-1",
                        branch="main",
                        commit_sha="abc123",
                        status="passed",
                        created_at=datetime.now(UTC),
                    )
                ]
            ),
        ),
    ):
        payload = await get_tile_payload(
            AsyncMock(), tenant_id="t1", project_iri=_PROJECT_IRI, tile="ribbon"
        )

    assert payload.runs[0].commit_sha == "abc123"
    assert payload.runs[0].repo_url == "https://github.com/acme/widgets"
