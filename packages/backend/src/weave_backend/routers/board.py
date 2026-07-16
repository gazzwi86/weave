"""FR-015/016/017 (BE-V1-TASK-017, build-engine EPIC-004):
`GET /api/projects/{project_iri}/board` and
`GET /api/projects/{project_iri}/task-tree` -- board + tree read routes over
the M1 state spine. Company-open read (any authenticated tenant member),
same `get_current_principal` + `tenant_connection` pattern as
`routers/runs.py`'s `get_state_route`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.build.board import build_board, build_task_tree
from weave_backend.build.state_spine import StateSpine, load_state_spine
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.model import get_project
from weave_backend.schemas.board import BoardResponse, TaskTreeResponse

router = APIRouter(tags=["board"])


async def _load_spine_or_404(project_iri: str, principal: Principal) -> StateSpine:
    async with tenant_connection(principal.tenant_id) as conn:
        spine = await load_state_spine(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
        if spine is not None:
            return spine
        # BUG-06: a project with no run yet has no `state_spines` row --
        # that is a valid, empty board/tree, not a missing project. Only
        # fall through to 404 when the project itself doesn't exist.
        project = await get_project(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
    if project is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return StateSpine(project_iri=project_iri, tenant_id=principal.tenant_id, run_id="", turn_cap=0)


@router.get("/api/projects/{project_iri}/board", response_model=BoardResponse)
async def get_board_route(
    project_iri: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> BoardResponse:
    spine = await _load_spine_or_404(project_iri, principal)
    return build_board(spine)


@router.get("/api/projects/{project_iri}/task-tree", response_model=TaskTreeResponse)
async def get_task_tree_route(
    project_iri: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> TaskTreeResponse:
    spine = await _load_spine_or_404(project_iri, principal)
    return build_task_tree(spine)
