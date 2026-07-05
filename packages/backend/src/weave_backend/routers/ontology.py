"""CE-VERSION-1 / CE-DIFF-1: version history, publish lifecycle, and
version-to-version diff (E9-S3, AC-002-07/-09/-11/-12/-13/-14).
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.operations import diff as diff_ops
from weave_backend.operations import versioning
from weave_backend.rbac import enforce_workspace_role
from weave_backend.schemas.ontology import (
    DiffResponse,
    ModificationModel,
    PublishResponse,
    TripleModel,
    VersionEntry,
    VersionsResponse,
)
from weave_backend.tenancy.sessions import get_active_workspace
from weave_backend.tenancy.workspaces import get_workspace

router = APIRouter(prefix="/api/ontology", tags=["ontology"])


async def _resolve_workspace_id(principal: Principal, requested: str | None) -> str:
    workspace_id = requested or await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})
    return workspace_id


async def _authorize_read(
    conn: asyncpg.Connection, *, principal: Principal, workspace_id: str
) -> None:
    """Shared 404-before-403 IDOR-safe check for both read routes below."""
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


@router.get("/versions", response_model=VersionsResponse)
async def list_versions_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    workspace_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
) -> VersionsResponse:
    resolved_workspace_id = await _resolve_workspace_id(principal, workspace_id)

    async with tenant_connection(principal.tenant_id) as conn:
        await _authorize_read(conn, principal=principal, workspace_id=resolved_workspace_id)
        page_result = await versioning.list_versions(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=resolved_workspace_id,
            page=page,
            per_page=per_page,
        )

    return VersionsResponse(
        versions=[
            VersionEntry(
                version_iri=v.version_iri,
                semver=v.semver,
                status=v.status,
                created_at=v.created_at,
                published_at=v.published_at,
                actor_iri=v.actor_iri,
            )
            for v in page_result.versions
        ],
        total=page_result.total,
        page=page,
        per_page=per_page,
    )


@router.post("/versions/{version_iri}/publish", response_model=PublishResponse)
async def publish_version_route(
    version_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> PublishResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        # version_iri is a path param, not a `workspace_id`-scoped route --
        # discover its workspace first (404 if the row doesn't exist at all)
        # so `enforce_workspace_role` has something to check against.
        existing = await versioning.get_version(
            conn, tenant_id=principal.tenant_id, version_iri=version_iri
        )
        if existing is None:
            raise HTTPException(status_code=404, detail={"error": "version_not_found"})

        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=existing.workspace_id,
            user_sub=principal.sub,
            min_role="publish",
        )

        try:
            published = await versioning.publish_version(
                conn,
                tenant_id=principal.tenant_id,
                workspace_id=existing.workspace_id,
                version_iri=version_iri,
            )
        except versioning.VersionNotFound as exc:
            raise HTTPException(status_code=404, detail={"error": "version_not_found"}) from exc
        except versioning.VersionAlreadyPublished as exc:
            # AC-002-09's exact wording.
            raise HTTPException(
                status_code=405, detail={"message": "version is published and immutable"}
            ) from exc

    return PublishResponse(
        version_iri=published.version_iri,
        status=published.status,
        published_at=published.published_at,
    )


async def _resolve_known_version(
    conn: asyncpg.Connection, *, principal: Principal, workspace_id: str, version: str
) -> str:
    """AC-002-08: resolves the `latest` alias; AC-002-14: 404s if the
    resolved (or literal) version_iri isn't a real `graph_versions` row.
    """
    try:
        version_iri = await versioning.resolve_version(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace_id,
            version=version,
        )
    except versioning.VersionNotFound as exc:
        raise HTTPException(status_code=404, detail={"error": "version_not_found"}) from exc

    known = await versioning.get_version(
        conn, tenant_id=principal.tenant_id, version_iri=version_iri
    )
    if known is None:
        raise HTTPException(status_code=404, detail={"error": "version_not_found"})
    return version_iri


@router.get("/diff", response_model=DiffResponse)
async def diff_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    from_: Annotated[str, Query(alias="from")],
    to: str,
    workspace_id: str | None = Query(default=None),
) -> DiffResponse:
    resolved_workspace_id = await _resolve_workspace_id(principal, workspace_id)

    async with tenant_connection(principal.tenant_id) as conn:
        await _authorize_read(conn, principal=principal, workspace_id=resolved_workspace_id)
        from_iri = await _resolve_known_version(
            conn, principal=principal, workspace_id=resolved_workspace_id, version=from_
        )
        to_iri = await _resolve_known_version(
            conn, principal=principal, workspace_id=resolved_workspace_id, version=to
        )

    result = await diff_ops.compute_diff(from_iri, to_iri)
    return DiffResponse(
        added=[
            TripleModel(subject=t.subject, predicate=t.predicate, object=t.object)
            for t in result.added
        ],
        removed=[
            TripleModel(subject=t.subject, predicate=t.predicate, object=t.object)
            for t in result.removed
        ],
        modified=[
            ModificationModel(
                subject=m.subject, predicate=m.predicate, before=m.before, after=m.after
            )
            for m in result.modified
        ],
    )
