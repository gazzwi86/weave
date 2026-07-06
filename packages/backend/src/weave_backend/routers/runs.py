"""AC-1..AC-8: `POST /api/projects/{project_iri}/runs`, `GET /api/state/{project_iri}`
(BE-TASK-006, build-engine EPIC-011).
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.build.orchestrator import run_dark_factory
from weave_backend.build.state_spine import (
    RunAlreadyActive,
    load_state_spine,
    start_or_resume_run,
)
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.model import get_project
from weave_backend.repo_bootstrap.service import RepoBootstrapError
from weave_backend.schemas.runs import (
    StartRunRequest,
    StartRunResponse,
    StateSpineResponse,
    TaskStateResponse,
)
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import InvalidScopeIri

router = APIRouter(tags=["runs"])

#: AC-1's default (Implementation Hints) -- overridable per-project via
#: `PLAT-SETTINGS-1` (`build.turn_cap`).
DEFAULT_TURN_CAP = 60


async def _effective_turn_cap(  # type: ignore[no-untyped-def]
    conn, *, tenant_id: str, project_iri: str, override: int | None
) -> int:
    """AC-1: an explicit request override wins outright; otherwise resolve
    via `PLAT-SETTINGS-1`, falling back to `DEFAULT_TURN_CAP` the same way
    `typed_result.get_retry_ceiling` does.

    ponytail: the brief notes an override is "capped by PLAT-SETTINGS-1" --
    clamping an explicit override against a cascaded ceiling is a second
    settings lookup this task's 8 ACs don't exercise. Add the clamp if a
    later task needs it enforced, not just resolved.
    """
    if override is not None:
        return override
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key="build.turn_cap", context_iri=project_iri
        )
    except (SettingNotFound, InvalidScopeIri):
        return DEFAULT_TURN_CAP
    return int(resolved.value)


@router.post(
    "/api/projects/{project_iri}/runs", status_code=202, response_model=StartRunResponse
)
async def start_run_route(
    project_iri: str,
    body: StartRunRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> StartRunResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        project = await get_project(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
        if project is None:
            raise HTTPException(status_code=404, detail={"error": "not_found"})

        turn_cap = await _effective_turn_cap(
            conn,
            tenant_id=principal.tenant_id,
            project_iri=project_iri,
            override=body.turn_cap_override,
        )
        try:
            spine = await start_or_resume_run(
                conn,
                tenant_id=principal.tenant_id,
                project_iri=project_iri,
                run_id=str(uuid.uuid4()),
                turn_cap=turn_cap,
            )
        except RunAlreadyActive as exc:
            raise HTTPException(
                status_code=409, detail={"error": "run_already_active", "run_id": exc.run_id}
            ) from exc

        try:
            spine = await run_dark_factory(conn, spine, tenant_id=principal.tenant_id)
        except RepoBootstrapError as exc:
            raise HTTPException(status_code=422, detail={"error": exc.reason}) from exc

    return StartRunResponse(
        run_id=spine.run_id,
        project_iri=spine.project_iri,
        status=spine.phase,
        turn_cap=spine.turn_cap,
    )


@router.get("/api/state/{project_iri}", response_model=StateSpineResponse)
async def get_state_route(
    project_iri: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> StateSpineResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        spine = await load_state_spine(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
    if spine is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return StateSpineResponse(
        project_iri=spine.project_iri,
        phase=spine.phase,
        dispatch_count=spine.dispatch_count,
        tasks=[TaskStateResponse(**t.model_dump()) for t in spine.tasks],
    )
