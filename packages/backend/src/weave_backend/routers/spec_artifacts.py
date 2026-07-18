"""G11 (docs/design/remediation-2-api-gaps.md):
`GET /api/projects/{project_iri}/spec-artifacts` -- read route over
`build.spec_artifacts`'s brief-derived index. Company-open read, same
`get_current_principal` + `tenant_connection` pattern as
`routers/board.py`; the run-less-project "empty index, not 404" split is
copied from that router's BUG-06 fix verbatim (same underlying
`state_spines` row absence).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.briefs.store import list_project_briefs
from weave_backend.build.spec_artifacts import build_spec_artifact_index
from weave_backend.build.state_spine import StateSpine, load_state_spine
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.model import get_project
from weave_backend.schemas.spec_artifacts import SpecArtifactIndexResponse

router = APIRouter(tags=["spec-artifacts"])


async def _load_spine_or_404(project_iri: str, principal: Principal) -> StateSpine:
    async with tenant_connection(principal.tenant_id) as conn:
        spine = await load_state_spine(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
        if spine is not None:
            return spine
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
    if project is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return StateSpine(project_iri=project_iri, tenant_id=principal.tenant_id, run_id="", turn_cap=0)


@router.get("/api/projects/{project_iri}/spec-artifacts", response_model=SpecArtifactIndexResponse)
async def get_spec_artifacts_route(
    project_iri: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> SpecArtifactIndexResponse:
    spine = await _load_spine_or_404(project_iri, principal)
    async with tenant_connection(principal.tenant_id) as conn:
        briefs = await list_project_briefs(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
    return build_spec_artifact_index(spine, briefs)
