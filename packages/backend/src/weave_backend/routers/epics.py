"""G9/G10 (docs/design/remediation-2-api-gaps.md):
`GET /api/projects/{project_iri}/epics` -- read route over `build.epics`'s
epic rollup derivation. Company-open read, same `get_current_principal` +
`tenant_connection` pattern as `routers/board.py`; the run-less-project
"empty rollup, not 404" split is copied from that router's BUG-06 fix
verbatim (same underlying `state_spines` row absence).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.briefs.store import epic_refs
from weave_backend.build.epics import build_epic_rollup
from weave_backend.build.state_spine import StateSpine, load_state_spine
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.model import get_project
from weave_backend.schemas.epics import EpicRollupResponse

router = APIRouter(tags=["epics"])


async def _load_spine_or_404(project_iri: str, principal: Principal) -> StateSpine:
    async with tenant_connection(principal.tenant_id) as conn:
        spine = await load_state_spine(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
        if spine is not None:
            return spine
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
    if project is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return StateSpine(project_iri=project_iri, tenant_id=principal.tenant_id, run_id="", turn_cap=0)


@router.get("/api/projects/{project_iri}/epics", response_model=EpicRollupResponse)
async def get_epics_route(
    project_iri: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> EpicRollupResponse:
    spine = await _load_spine_or_404(project_iri, principal)
    if not spine.tasks:
        # A run-less project has no tasks to group -- skip the round trip
        # rather than opening a connection just to fetch nothing.
        return build_epic_rollup(spine, {})
    async with tenant_connection(principal.tenant_id) as conn:
        refs = await epic_refs(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
    return build_epic_rollup(spine, refs)
