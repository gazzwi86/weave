"""AC-3: `GET /api/search` -- tenant-scoped entity search over the active
workspace's named graph, reusing the exact same authz + dataset-scoping
path as `/api/sparql` (see `_resolve_named_graph` there): `workspace_id` is
optional and falls back to the caller's active-session workspace when
omitted, so the frontend doesn't need its own workspace-picker state to
use the palette (PLAT-TASK-005 has no workspace-switcher UI in scope).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.rbac import enforce_workspace_role
from weave_backend.rdf.oxigraph_client import run_query
from weave_backend.rdf.query_rewriter import validate_query
from weave_backend.schemas.search import SearchResponse, SearchResult
from weave_backend.search.sparql_search import MIN_QUERY_LENGTH, build_search_query
from weave_backend.tenancy.sessions import get_active_workspace
from weave_backend.tenancy.workspaces import Workspace, get_workspace

router = APIRouter(prefix="/api", tags=["search"])


async def _authorize_search(
    principal: Principal, requested_workspace_id: str | None, q: str
) -> Workspace:
    """Same IDOR-safe shape as `sparql._resolve_named_graph`: 404 on a
    foreign/missing workspace before the 403 role check (ledger item 3),
    never leaking existence via the role-check branch. Audits the search
    intent (attributable per PLAT-IDENTITY-1) once authz has passed --
    only for a real search attempt (>= MIN_QUERY_LENGTH), not every
    below-threshold keystroke.
    """
    workspace_id = requested_workspace_id or await get_active_workspace(
        principal.tenant_id, principal.sub
    )
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})

    async with tenant_connection(principal.tenant_id) as conn:
        workspace = await get_workspace(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
        if workspace is None:
            raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace_id,
            user_sub=principal.sub,
            min_role="read",
        )
        if len(q) >= MIN_QUERY_LENGTH:
            await default_audit_emitter.emit(
                conn,
                AuditEvent(
                    tenant_id=principal.tenant_id,
                    event_type="search.performed",
                    actor_iri=principal.principal_iri,
                    subject_iri=workspace.named_graph_iri,
                    payload={"q": q},
                ),
            )
    return workspace


@router.get("/search", response_model=SearchResponse)
async def search_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    q: str = Query(default="", max_length=200),
    workspace_id: str | None = Query(default=None),
) -> SearchResponse:
    workspace = await _authorize_search(principal, workspace_id, q)

    if len(q) < MIN_QUERY_LENGTH:
        return SearchResponse(results=[], total=0)

    query = build_search_query(q)
    validate_query(query)
    raw = await run_query(query, workspace.named_graph_iri)
    results = [
        SearchResult(
            iri=binding["iri"]["value"],
            label=binding["label"]["value"],
            kind=binding.get("kind", {}).get("value", ""),
        )
        for binding in raw["results"]["bindings"]
    ]
    return SearchResponse(results=results, total=len(results))
