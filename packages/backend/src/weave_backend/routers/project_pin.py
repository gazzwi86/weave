"""FR-012 (TASK-016, build-engine EPIC-002): review + confirm an ontology
pin upgrade. `GET .../pin-diff` fetches CE-DIFF-1 between the project's
current pin and CE's latest published version (CE-VERSION-1 for "latest",
then CE-DIFF-1 for the diff) -- read-only, no guard, same as every other PM
read. `POST .../pin-upgrade` re-verifies the caller's `confirm_version_iri`
against a freshly-fetched latest before writing -- never trusts the
client-supplied value alone (AC-3) -- guarded by
`require_project_role(ProjectAction.SETTINGS)` same as `project_settings.py`.

contracts.md's CE-DIFF-1 amendment: CE additionally computes a `versions`
breaking-span (`[{version_iri, breaking}]`) at publish time. Not yet
implemented on CE's own `DiffResponse`/`VersionEntry` (see
`schemas/ontology.py`) -- `get_ontology_diff` reads `versions` defensively
and this route passes it through verbatim. Build must never derive
breakingness itself (contracts.md CE-DIFF-1) -- an empty list here just
means CE hasn't shipped the field yet, not "no breaking changes exist".
"""

from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.ce_version_client import (
    CeDiffUnavailable,
    CeVersionUnavailable,
    get_ce_client,
    get_ontology_diff,
    get_pinned_latest_version,
)
from weave_backend.projects.model import get_project, update_project_pin
from weave_backend.rbac import ProjectAction, require_project_role
from weave_backend.schemas.project_pin import (
    PinBreakingVersion,
    PinDiffResponse,
    PinUpgradeRequest,
    PinUpgradeResponse,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _auth_headers(authorization: str | None) -> dict[str, str] | None:
    return {"Authorization": authorization} if authorization else None


@router.get("/{project_iri}/pin-diff", response_model=PinDiffResponse)
async def get_pin_diff_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[httpx.AsyncClient, Depends(get_ce_client)],
    authorization: Annotated[str | None, Header()] = None,
) -> PinDiffResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
    if project is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})

    headers = _auth_headers(authorization)
    try:
        latest = await get_pinned_latest_version(ce_client, headers=headers)
        body = await get_ontology_diff(
            ce_client,
            from_version=project.pinned_graph_version_iri,
            to_version=latest,
            headers=headers,
        )
    except (CeVersionUnavailable, CeDiffUnavailable) as exc:
        raise HTTPException(status_code=503, detail={"error": "diff_unavailable"}) from exc

    return PinDiffResponse(
        from_version_iri=project.pinned_graph_version_iri,
        to_version_iri=latest,
        added=body.get("added", []),
        removed=body.get("removed", []),
        modified=body.get("modified", []),
        versions=[PinBreakingVersion(**v) for v in body.get("versions", [])],
    )


@router.post("/{project_iri}/pin-upgrade", response_model=PinUpgradeResponse)
async def upgrade_pin_route(
    project_iri: str,
    body: PinUpgradeRequest,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.SETTINGS))],
    ce_client: Annotated[httpx.AsyncClient, Depends(get_ce_client)],
    authorization: Annotated[str | None, Header()] = None,
) -> PinUpgradeResponse:
    headers = _auth_headers(authorization)
    try:
        latest = await get_pinned_latest_version(ce_client, headers=headers)
    except CeVersionUnavailable as exc:
        raise HTTPException(status_code=503, detail={"error": "diff_unavailable"}) from exc

    if body.confirm_version_iri != latest:
        # AC-3: the pin moved under the caller since they last fetched the
        # diff -- refuse rather than silently applying a stale confirm.
        raise HTTPException(
            status_code=409, detail={"error": "pin_moved", "latest_version_iri": latest}
        )

    async with tenant_connection(principal.tenant_id) as conn:
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
        if project is None:
            raise HTTPException(status_code=404, detail={"error": "not_found"})
        await update_project_pin(
            conn,
            tenant_id=principal.tenant_id,
            project_iri=project_iri,
            pinned_graph_version_iri=latest,
        )
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type="project.pin.upgraded",
                actor_iri=principal.principal_iri,
                subject_iri=project_iri,
                payload={"old_pin": project.pinned_graph_version_iri, "new_pin": latest},
                engine="build",
            ),
        )

    return PinUpgradeResponse(pinned_graph_version_iri=latest)
