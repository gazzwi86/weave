"""CE-TASK-006 (FR-027, m2-delta.md §7): `GET /api/validate` -- full
tenant-scoped SHACL report for `version=latest|{iri}|draft`. Mirrors
`routers/metrics.py`'s cache-check-then-compute route shape.
"""

from __future__ import annotations

from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from rdflib import Graph

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.operations import validate_cache, validate_report, versioning
from weave_backend.operations.shacl import shapes_version_token
from weave_backend.rbac import InsufficientRole, enforce_workspace_role
from weave_backend.rdf.oxigraph_client import fetch_graph_ntriples
from weave_backend.schemas.validate import ValidationPending, ValidationReport
from weave_backend.tenancy.sessions import get_active_workspace, get_redis
from weave_backend.tenancy.workspaces import Workspace, get_workspace

router = APIRouter(prefix="/api/validate", tags=["validate"])


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


@router.get("", response_model=None)
async def validate_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    version: str = Query(default="latest"),
    run: bool = Query(default=False),
    workspace_id: str | None = Query(default=None),
) -> ValidationReport | ValidationPending:
    """AC-006-01/-02/-04: `?version=latest|{iri}|draft`, 404 on an unknown
    version, 401 (via `get_current_principal`) with no JWT. Default
    `run=false` is a cheap cache-only read -- a miss is honestly
    `{"pending": true}`, never a stale or fake-zero report; `run=true`
    triggers the heavy `pyshacl` pass on a miss (and still returns the
    cached report on a hit, no redundant recompute).
    """
    resolved_workspace_id = await _resolve_workspace_id(principal, workspace_id)

    async with tenant_connection(principal.tenant_id) as conn:
        workspace = await _load_workspace_or_404(
            conn, tenant_id=principal.tenant_id, workspace_id=resolved_workspace_id
        )
        await _authorize_read(conn, principal=principal, workspace=workspace)

        try:
            graph_iri, data_stamp = await validate_report.resolve_graph(
                conn, tenant_id=principal.tenant_id, workspace=workspace, version=version
            )
        except versioning.VersionNotFound as exc:
            raise HTTPException(status_code=404, detail={"error": "version_not_found"}) from exc

        # ponytail: same `Any` escape hatch as governance.py -- redis-py's
        # concrete Redis doesn't structurally satisfy RedisLike (param name
        # `name` vs `key`); only matters for get_redis()'s real object.
        redis: Any = get_redis()
        shapes_token = await shapes_version_token(principal.tenant_id, redis)
        state_stamp = validate_report.compose_state_stamp(data_stamp, shapes_token)

        cached = await validate_cache.get_cached_report(
            redis, principal.tenant_id, workspace.id, state_stamp
        )
        if cached is not None:
            return ValidationReport.model_validate(cached)
        if not run:
            return ValidationPending()

        ntriples = await fetch_graph_ntriples(graph_iri)
        data_graph = Graph()
        if ntriples:
            data_graph.parse(data=ntriples, format="nt")

        report = await validate_report.build_report(
            data_graph,
            tenant_id=principal.tenant_id,
            redis_client=redis,
            version_resolved=graph_iri,
        )

    await validate_cache.store_report(
        redis, principal.tenant_id, workspace.id, state_stamp, report.model_dump(mode="json")
    )
    return report
