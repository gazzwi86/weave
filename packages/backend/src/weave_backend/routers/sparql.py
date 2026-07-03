"""AC-6/AC-7: the only route allowed to talk to Oxigraph. Every query is
rewritten to the caller's active (or explicitly named, still tenant-owned)
workspace's named graph before it's ever sent -- see `rdf/query_rewriter.py`
for the single choke point this depends on.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.rbac import enforce_workspace_role
from weave_backend.rdf.oxigraph_client import run_query
from weave_backend.rdf.query_rewriter import (
    DisallowedQueryError,
    UnscopedQueryError,
    validate_query,
)
from weave_backend.schemas.sparql import SparqlQueryRequest
from weave_backend.tenancy.sessions import get_active_workspace
from weave_backend.tenancy.workspaces import get_workspace

router = APIRouter(prefix="/api", tags=["sparql"])


async def _resolve_named_graph(principal: Principal, requested_workspace_id: str | None) -> str:
    """QA FAIL remediation (AC-3): the caller's workspace_id here comes from
    the request body (or the active-session fallback), never a path param,
    so it must be checked against workspace_members explicitly rather than
    via the `require_workspace_role` path-param dependency.
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
    return workspace.named_graph_iri


@router.post("/sparql")
async def run_sparql_route(
    body: SparqlQueryRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> dict[str, Any]:
    named_graph_iri = await _resolve_named_graph(principal, body.workspace_id)
    try:
        validate_query(body.query)
    except UnscopedQueryError as exc:
        raise HTTPException(status_code=400, detail={"error": "unscoped_query_rejected"}) from exc
    except DisallowedQueryError as exc:
        raise HTTPException(status_code=400, detail={"error": "disallowed_query"}) from exc

    return await run_query(body.query, named_graph_iri)
