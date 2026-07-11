"""BE-V1-TASK-019 (FR-013): per-tile status reads for the project dashboard.
Six independent handlers behind one dispatcher -- a tile failing never
touches another tile's query (AC-2's isolation is structural here too, not
just in the UI).
"""

from __future__ import annotations

from typing import Any, Protocol

import asyncpg

from weave_backend.build.costs import get_costs, resolve_budget_cap
from weave_backend.build.state_spine import TaskState, load_state_spine
from weave_backend.generation.store import list_recent_runs
from weave_backend.projects.model import get_project
from weave_backend.repo_bootstrap.store import fetch_project_repo_row
from weave_backend.schemas.costs import ForecastInputsResponse
from weave_backend.schemas.dashboard import (
    BlockerItem,
    BlockersTile,
    BudgetTile,
    DemoTile,
    ForecastTile,
    RibbonRun,
    RibbonTile,
    TaskCountsTile,
)


class UnknownTile(Exception):
    """AC-1: `tile` is a plain `str` path param (not `Literal`) so an
    unrecognised segment is this app-level exception, mapped to a 400 by
    the router -- FastAPI's automatic enum-path validation would 422
    instead, which the AC does not allow.
    """


class ProjectNotFound(Exception):
    """Mapped to 404 by the router."""


# AC-4: "blockers" reasons -- only `dep_summary_missing` is ever actually
# produced by `orchestrator.py` today; any other hold_reason string is
# surfaced verbatim rather than swallowed.
_HOLD_REASON_TEXT = {"dep_summary_missing": "missing handoff"}


def _blocker_reason(task: TaskState) -> str:
    if task.hold_reason:
        return _HOLD_REASON_TEXT.get(task.hold_reason, task.hold_reason)
    return "HITL pending"


async def _demo_tile(conn: asyncpg.Connection, tenant_id: str, project_iri: str) -> DemoTile:
    project = await get_project(conn, tenant_id=tenant_id, project_iri=project_iri)
    if project is None:
        raise ProjectNotFound(project_iri)
    runs = await list_recent_runs(conn, tenant_id=tenant_id, project_iri=project_iri, limit=1)
    last_status = runs[0].status if runs else None
    return DemoTile(
        output_location_ref=project.demo_output_location_ref,
        last_run_status=last_status,  # type: ignore[arg-type]
    )


async def _budget_tile(conn: asyncpg.Connection, tenant_id: str, project_iri: str) -> BudgetTile:
    # `get_costs` never returns the cap -- resolved separately (AC-4's
    # "binding cascade level" is `ResolvedCap.level`, not a costs field).
    payload = await get_costs(conn, tenant_id=tenant_id, project_iri=project_iri)
    cap = await resolve_budget_cap(conn, tenant_id=tenant_id, context_iri=project_iri)
    return BudgetTile(
        label=payload.label,
        total_estimate_usd=float(payload.total_estimate_usd),
        cap_usd=float(cap.cap_usd) if cap else None,
        level=cap.level if cap else None,
    )


async def _forecast_tile(
    conn: asyncpg.Connection, tenant_id: str, project_iri: str
) -> ForecastTile:
    payload = await get_costs(conn, tenant_id=tenant_id, project_iri=project_iri)
    inputs = payload.forecast_inputs
    return ForecastTile(
        label=payload.label,
        forecast_usd=float(payload.forecast_usd),
        forecast_inputs=ForecastInputsResponse(
            basis=inputs.basis,
            mean_actual=float(inputs.mean_actual),
            completed_count=inputs.completed_count,
            remaining_count=inputs.remaining_count,
            calibration=float(inputs.calibration),
        ),
    )


async def _tasks_tile(conn: asyncpg.Connection, tenant_id: str, project_iri: str) -> TaskCountsTile:
    spine = await load_state_spine(conn, tenant_id=tenant_id, project_iri=project_iri)
    tasks = spine.tasks if spine else []
    return TaskCountsTile(
        ready=sum(1 for t in tasks if t.status == "Ready"),
        blocked=sum(1 for t in tasks if t.status == "Blocked"),
        done=sum(1 for t in tasks if t.status == "Done"),
        revision=sum(1 for t in tasks if t.status == "revision"),
    )


async def _blockers_tile(
    conn: asyncpg.Connection, tenant_id: str, project_iri: str
) -> BlockersTile:
    spine = await load_state_spine(conn, tenant_id=tenant_id, project_iri=project_iri)
    tasks = spine.tasks if spine else []
    items = [
        BlockerItem(task_id=t.id, reason=_blocker_reason(t))
        for t in tasks
        if t.status == "Blocked" or t.hold_reason is not None
    ]
    return BlockersTile(items=items)


async def _ribbon_tile(conn: asyncpg.Connection, tenant_id: str, project_iri: str) -> RibbonTile:
    # AC-5: reads recorded rows only -- no live SCM call on page load.
    repo_row = await fetch_project_repo_row(conn, tenant_id=tenant_id, project_iri=project_iri)
    repo_url = repo_row.repo_url if repo_row else None
    runs = await list_recent_runs(conn, tenant_id=tenant_id, project_iri=project_iri, limit=5)
    return RibbonTile(
        runs=[
            RibbonRun(
                run_id=run.run_id,
                branch=run.branch,
                commit_sha=run.commit_sha,
                created_at=run.created_at,
                repo_url=repo_url,
            )
            for run in runs
        ]
    )


class _TileHandler(Protocol):
    async def __call__(
        self, conn: asyncpg.Connection, tenant_id: str, project_iri: str
    ) -> Any: ...


_HANDLERS: dict[str, _TileHandler] = {
    "demo": _demo_tile,
    "budget": _budget_tile,
    "forecast": _forecast_tile,
    "tasks": _tasks_tile,
    "blockers": _blockers_tile,
    "ribbon": _ribbon_tile,
}


async def get_tile_payload(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, tile: str
) -> Any:
    handler = _HANDLERS.get(tile)
    if handler is None:
        raise UnknownTile(tile)
    return await handler(conn, tenant_id, project_iri)
