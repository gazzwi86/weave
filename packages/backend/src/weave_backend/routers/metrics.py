"""CE-METRICS-1 (contracts.md): `GET /api/metrics/ontology` -- aggregate
counts for the composable Generative Dashboard (M2+; the M1 fixed dashboard
does not consume this per contracts.md). Read-only, no write routes (DoD).

Workspace resolution: the contract is param-free, and its named consumer is
an in-app dashboard screen (a human session with an active workspace) --
not a headless service caller (contracts.md: "Consumer: composable
Generative Dashboard"). `?workspace_id=` is accepted as an optional override
only for parity with the sibling `routers/ontology.py` read routes; the
default path resolves the caller's active workspace exactly as they do.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.operations import aggregate_metrics
from weave_backend.operations.metrics_cache import get_cached_metrics, store_metrics
from weave_backend.rbac import InsufficientRole, enforce_workspace_role
from weave_backend.schemas.metrics import DraftPublishedDelta, MetricsResponse, PendingMarker
from weave_backend.tenancy.sessions import get_active_workspace, get_redis
from weave_backend.tenancy.workspaces import Workspace, get_workspace

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


async def _resolve_workspace_id(principal: Principal, requested: str | None) -> str:
    workspace_id = requested or await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})
    return workspace_id


async def _load_workspace_or_404(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> Workspace:
    workspace = await get_workspace(conn, tenant_id=tenant_id, workspace_id=workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})
    return workspace


async def _authorize_read(
    conn: asyncpg.Connection, *, principal: Principal, workspace: Workspace
) -> None:
    """Same read-role floor as `routers/ontology.py`'s `_authorize_read` --
    RLS alone would let a same-tenant caller's query through even with no
    role on this workspace; reimplemented locally since those helpers are
    private to `ontology.py` too (not meant for cross-module import).
    """
    try:
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace.id,
            user_sub=principal.sub,
            min_role="read",
        )
    except InsufficientRole as exc:
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type="access.rbac.denied",
                actor_iri=principal.principal_iri,
                subject_iri=workspace.named_graph_iri,
                engine="constitution",
                payload={"required_role": "read"},
            ),
        )
        raise exc


async def _compute(
    conn: asyncpg.Connection, *, principal: Principal, workspace: Workspace
) -> MetricsResponse:
    counts = await aggregate_metrics.entity_count_by_kind(workspace.named_graph_iri)
    latest_version = await aggregate_metrics.resolve_latest_version(
        conn, tenant_id=principal.tenant_id, workspace_id=workspace.id
    )
    delta = await aggregate_metrics.draft_published_delta(
        draft_graph_iri=workspace.named_graph_iri, latest_published_iri=latest_version
    )
    return MetricsResponse(
        entity_count_by_kind=counts,
        latest_version=latest_version,
        draft_published_delta=DraftPublishedDelta(
            added=delta.added, removed=delta.removed, modified=delta.modified
        ),
        # AC-007-03: no stored SHACL report / OWL reasoner result exists yet
        # anywhere in the codebase (TASK-006 backlog; reasoner is post-v1
        # EPIC-008) -- always pending in v1, by design, never a stale zero.
        shacl_errors_by_severity=PendingMarker(),
        owl_inconsistencies=PendingMarker(),
    )


@router.get("/ontology", response_model=MetricsResponse)
async def metrics_ontology_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    workspace_id: str | None = Query(default=None),
) -> MetricsResponse:
    resolved_workspace_id = await _resolve_workspace_id(principal, workspace_id)

    async with tenant_connection(principal.tenant_id) as conn:
        workspace = await _load_workspace_or_404(
            conn, tenant_id=principal.tenant_id, workspace_id=resolved_workspace_id
        )
        await _authorize_read(conn, principal=principal, workspace=workspace)

        redis = get_redis()
        cached = await get_cached_metrics(redis, principal.tenant_id, workspace.id)
        if cached is not None:
            return MetricsResponse.model_validate(cached)

        response = await _compute(conn, principal=principal, workspace=workspace)

    await store_metrics(redis, principal.tenant_id, workspace.id, response.model_dump())
    return response
