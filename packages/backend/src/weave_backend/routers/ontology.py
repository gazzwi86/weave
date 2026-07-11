"""CE-VERSION-1 / CE-DIFF-1: version history, publish lifecycle, and
version-to-version diff (E9-S3, AC-002-07/-09/-11/-12/-13/-14).
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.notifications.dispatch import dispatch_notification
from weave_backend.notifications.store import NotificationEvent
from weave_backend.ontology import catalogue
from weave_backend.ontology import resource as resource_lookup
from weave_backend.operations import diff as diff_ops
from weave_backend.operations import versioning
from weave_backend.rbac import (
    ROLE_RANK,
    InsufficientRole,
    enforce_workspace_role,
    resolve_workspace_role,
)
from weave_backend.schemas.ontology import (
    DiffResponse,
    IncomingEdgeModel,
    KindEntry,
    ModificationModel,
    OntologyTypesResponse,
    OutgoingEdgeModel,
    PropertyShapeModel,
    PublishResponse,
    ResourceResponse,
    TripleModel,
    VersionEntry,
    VersionsResponse,
)
from weave_backend.tenancy.members import list_active_member_subs
from weave_backend.tenancy.sessions import get_active_workspace
from weave_backend.tenancy.workspaces import Workspace, get_workspace

router = APIRouter(prefix="/api/ontology", tags=["ontology"])


def _property_shape_model(prop: catalogue.PropertyShape) -> PropertyShapeModel:
    return PropertyShapeModel(
        path=prop.path,
        name=prop.name,
        is_relationship=prop.is_relationship,
        min_count=prop.min_count,
        max_count=prop.max_count,
        severity=prop.severity,
    )


@router.get("/types", response_model=OntologyTypesResponse)
async def ontology_types_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> OntologyTypesResponse:
    """CE-READ-1 AC-003-01: the full BPMO kind/relationship catalogue,
    introspected live from the SHACL shapes graph. Requires auth (AC-003-07)
    but no workspace/tenant scoping -- the framework catalogue is shared
    across every tenant, it is not tenant data.
    """
    del principal  # auth-only: presence of a valid principal is the gate
    kinds = catalogue.list_kinds()
    relationships = catalogue.list_relationships(kinds)
    return OntologyTypesResponse(
        kinds=[
            KindEntry(
                iri=k.iri,
                label=k.label,
                properties=[_property_shape_model(p) for p in k.properties],
                description=k.description,
            )
            for k in kinds
        ],
        relationships=[_property_shape_model(p) for p in relationships],
    )


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


async def _authorize_workspace_role(
    conn: asyncpg.Connection, *, principal: Principal, workspace: Workspace, min_role: str
) -> HTTPException | None:
    """404-before-403 IDOR-safe role check, always against `workspace`'s REAL
    id (PR #23 finding #1 -- never a caller-supplied workspace_id a version
    hasn't been independently confirmed to belong to). Returns the denial
    rather than raising, so the caller can commit an `access.rbac.denied`
    audit entry before the request actually fails -- same deferred-raise
    pattern as `routers/operations.py::_enforce_write_access`.
    """
    try:
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace.id,
            user_sub=principal.sub,
            min_role=min_role,
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
                payload={"required_role": min_role},
            ),
        )
        return exc
    return None


async def _authorize_read(
    conn: asyncpg.Connection, *, principal: Principal, workspace: Workspace
) -> HTTPException | None:
    return await _authorize_workspace_role(
        conn, principal=principal, workspace=workspace, min_role="read"
    )


async def _list_versions_outcome(
    conn: asyncpg.Connection,
    *,
    principal: Principal,
    workspace_id: str,
    page: int,
    per_page: int,
) -> VersionsResponse | HTTPException:
    workspace = await _load_workspace_or_404(
        conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
    )
    denied = await _authorize_read(conn, principal=principal, workspace=workspace)
    if denied is not None:
        return denied

    # AC-003-03: draft versions are only visible to callers with author+
    # role -- a plain "read" caller only ever sees published history.
    role = await resolve_workspace_role(
        conn, tenant_id=principal.tenant_id, workspace_id=workspace_id, user_sub=principal.sub
    )
    include_drafts = role is not None and ROLE_RANK.get(role, -1) >= ROLE_RANK["author"]

    # is_latest (CE-READ-1): the newest *published* version, resolved once
    # up front -- `None` when the workspace has no published version yet
    # (every entry then reports is_latest=False, matching the "unavailable"
    # 503 the client raises when it sees no is_latest entry).
    try:
        latest_iri = await versioning.resolve_version(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id, version="latest"
        )
    except versioning.VersionNotFound:
        latest_iri = None

    page_result = await versioning.list_versions(
        conn,
        tenant_id=principal.tenant_id,
        workspace_id=workspace_id,
        page=versioning.Page(number=page, size=per_page),
        include_drafts=include_drafts,
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
                is_latest=v.version_iri == latest_iri,
            )
            for v in page_result.versions
        ],
        total=page_result.total,
        page=page,
        per_page=per_page,
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
        outcome = await _list_versions_outcome(
            conn,
            principal=principal,
            workspace_id=resolved_workspace_id,
            page=page,
            per_page=per_page,
        )

    if isinstance(outcome, HTTPException):
        raise outcome
    return outcome


async def _publish_version_outcome(
    conn: asyncpg.Connection, *, principal: Principal, version_iri: str
) -> PublishResponse | HTTPException:
    # version_iri is a path param, not a `workspace_id`-scoped route --
    # discover its real workspace first (404 if the row doesn't exist at
    # all) so authorization has a real workspace to check against.
    existing = await versioning.get_version(
        conn, tenant_id=principal.tenant_id, version_iri=version_iri
    )
    if existing is None:
        raise HTTPException(status_code=404, detail={"error": "version_not_found"})

    workspace = await _load_workspace_or_404(
        conn, tenant_id=principal.tenant_id, workspace_id=existing.workspace_id
    )
    denied = await _authorize_workspace_role(
        conn, principal=principal, workspace=workspace, min_role="publish"
    )
    if denied is not None:
        return denied

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

    # PR #23 finding #5: the ontology routes were audit-silent on success --
    # every other mutating route emits a PLAT-AUDIT-1 entry.
    await default_audit_emitter.emit(
        conn,
        AuditEvent(
            tenant_id=principal.tenant_id,
            event_type="ontology.version.published",
            actor_iri=principal.principal_iri,
            subject_iri=version_iri,
            engine="constitution",
            payload={"semver": published.semver},
        ),
    )
    # A published version is a release the whole workspace works against --
    # every active member except the publisher gets an in-app notification.
    await _notify_members_of_publish(
        conn,
        principal=principal,
        workspace_id=existing.workspace_id,
        version_iri=version_iri,
        semver=published.semver,
    )
    return PublishResponse(
        version_iri=published.version_iri,
        status=published.status,
        published_at=published.published_at,
    )


async def _notify_members_of_publish(
    conn: asyncpg.Connection,
    *,
    principal: Principal,
    workspace_id: str,
    version_iri: str,
    semver: str,
) -> None:
    subs = await list_active_member_subs(
        conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
    )
    for sub in subs:
        recipient_iri = human_principal_iri(sub)
        if recipient_iri == principal.principal_iri:
            continue
        await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=principal.tenant_id,
                recipient_iri=recipient_iri,
                event_type="ontology.version.published",
                payload={"version_iri": version_iri, "semver": semver},
                actor_iri=principal.principal_iri,
            ),
        )


@router.post("/versions/{version_iri}/publish", response_model=PublishResponse)
async def publish_version_route(
    version_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> PublishResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        outcome = await _publish_version_outcome(conn, principal=principal, version_iri=version_iri)

    if isinstance(outcome, HTTPException):
        raise outcome
    return outcome


async def _resolve_known_version(
    conn: asyncpg.Connection, *, principal: Principal, workspace_id: str, version: str
) -> versioning.GraphVersion | HTTPException:
    """AC-002-08: resolves the `latest` alias (scoped to `workspace_id`);
    AC-002-14: 404s if the resolved (or literal) version_iri isn't a real
    `graph_versions` row. Returns the full version row, not just its IRI --
    PR #23 finding #1: an explicit version_iri may belong to a different
    workspace in the same tenant than `workspace_id`, and it's that REAL
    workspace the read must be authorized against, never the caller-supplied
    one.
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

    workspace = await _load_workspace_or_404(
        conn, tenant_id=principal.tenant_id, workspace_id=known.workspace_id
    )
    denied = await _authorize_read(conn, principal=principal, workspace=workspace)
    if denied is not None:
        return denied
    return known


@router.get("/resource/{iri:path}", response_model=ResourceResponse)
async def ontology_resource_route(
    iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
    version: str = "latest",
    workspace_id: str | None = Query(default=None),
) -> ResourceResponse:
    """AC-003-02: `iri` is the rest of the path (`{iri:path}`), URL-decoded
    by Starlette's path converter -- IRIs contain `/`, a plain `{iri}`
    segment would truncate at the first one. AC-003-09: an unknown
    `?version=` 404s via `_resolve_known_version`. Foreign-tenant IRIs 404
    too (never 403) -- `resource_lookup.lookup_resource` only ever sees the
    resolved version's own graph, so a resource that belongs to someone
    else's graph simply has no triples here.
    """
    resolved_workspace_id = await _resolve_workspace_id(principal, workspace_id)
    async with tenant_connection(principal.tenant_id) as conn:
        known = await _resolve_known_version(
            conn, principal=principal, workspace_id=resolved_workspace_id, version=version
        )
    if isinstance(known, HTTPException):
        raise known

    resource = await resource_lookup.lookup_resource(known.version_iri, iri)
    if resource is None:
        raise HTTPException(status_code=404, detail={"error": "resource_not_found"})

    return ResourceResponse(
        iri=resource.iri,
        kind=resource.kind,
        label=resource.label,
        version_iri=known.version_iri,
        triples=[
            TripleModel(subject=t.subject, predicate=t.predicate, object=t.object)
            for t in resource.triples
        ],
        outgoing=[
            OutgoingEdgeModel(predicate=e.predicate, target=e.other) for e in resource.outgoing
        ],
        incoming=[
            IncomingEdgeModel(predicate=e.predicate, source=e.other) for e in resource.incoming
        ],
    )


async def _resolve_diff_pair(
    conn: asyncpg.Connection, *, principal: Principal, workspace_id: str, from_: str, to: str
) -> tuple[versioning.GraphVersion, versioning.GraphVersion] | HTTPException:
    from_version = await _resolve_known_version(
        conn, principal=principal, workspace_id=workspace_id, version=from_
    )
    if isinstance(from_version, HTTPException):
        return from_version
    to_version = await _resolve_known_version(
        conn, principal=principal, workspace_id=workspace_id, version=to
    )
    if isinstance(to_version, HTTPException):
        return to_version
    return from_version, to_version


@router.get("/diff", response_model=DiffResponse)
async def diff_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    from_: Annotated[str, Query(alias="from")],
    to: str,
    workspace_id: str | None = Query(default=None),
) -> DiffResponse:
    resolved_workspace_id = await _resolve_workspace_id(principal, workspace_id)

    async with tenant_connection(principal.tenant_id) as conn:
        pair = await _resolve_diff_pair(
            conn,
            principal=principal,
            workspace_id=resolved_workspace_id,
            from_=from_,
            to=to,
        )

    if isinstance(pair, HTTPException):
        raise pair
    from_version, to_version = pair

    result = await diff_ops.compute_diff(from_version.version_iri, to_version.version_iri)
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
