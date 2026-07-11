"""TASK-020 (build-engine EPIC-007): `GET /api/projects/{id}/decisions` --
thin HTTP wrapper over `audit.decisions.list_decisions` (AC-1/AC-6/AC-7/
AC-8). Read-only: no `POST`/`PUT`/`DELETE` on this router, no write ever
touches `audit_entries` here. Tenant scope comes only from
`principal.tenant_id` (the JWT) -- there is no client-supplied tenant_id
query param to check, unlike `routers/audit.py`'s tenant-admin viewer.
`kind`/`search`/`cursor` are validated inline via `Query`/`Literal` (Law
13) -- no request-body schema exists because this route accepts none.
"""

from __future__ import annotations

from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.audit.decisions import AuditUnavailable, DecisionQuery, list_decisions
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.decisions import DecisionEntryResponse, DecisionPageResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])

_Kind = Literal["all", "decision", "task_update", "system"]


@router.get("/{project_iri}/decisions", response_model=DecisionPageResponse)
async def list_decisions_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
    kind: Annotated[_Kind, Query()] = "decision",
    search: Annotated[str | None, Query(max_length=200)] = None,
    cursor: Annotated[int | None, Query(ge=0)] = None,
) -> DecisionPageResponse:
    query = DecisionQuery(
        tenant_id=principal.tenant_id,
        project_iri=project_iri,
        kind=kind,
        search=search,
        cursor=cursor,
    )
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            page = await list_decisions(conn, query)
        except AuditUnavailable as exc:
            raise HTTPException(status_code=503, detail={"error": "audit_unavailable"}) from exc

    return DecisionPageResponse(
        entries=[
            DecisionEntryResponse(
                seq=e.seq,
                ts=e.ts,
                actor_principal_iri=e.actor_principal_iri,
                event_type=e.event_type,
                target_iri=e.target_iri,
                diff_summary=e.diff_summary,
                kind=cast('Literal["decision", "task_update", "system"]', e.kind),
            )
            for e in page.entries
        ],
        next_cursor=page.next_cursor,
    )
