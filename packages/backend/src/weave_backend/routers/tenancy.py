"""AC-1/AC-2/AC-3/AC-7: workspace + membership management."""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Response

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.dashboard.store import seed_tenant_default_tiles
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.rbac import require_workspace_role
from weave_backend.schemas.tenancy import (
    CreateWorkspaceRequest,
    InviteMemberRequest,
    MemberListResponse,
    MemberResponse,
    SwitchWorkspaceResponse,
    WorkspaceResponse,
)
from weave_backend.tenancy.invite_gateway import InviteGateway, get_invite_gateway
from weave_backend.tenancy.members import (
    MemberAlreadyActive,
    activate_member,
    invite_member,
    list_for_workspace,
    revoke_member,
)
from weave_backend.tenancy.sessions import (
    bump_session_version,
    get_active_workspace,
    set_active_workspace,
)
from weave_backend.tenancy.workspaces import (
    WorkspaceSlugTaken,
    create_workspace,
    get_workspace,
    list_workspaces,
)

router = APIRouter(prefix="/api", tags=["tenancy"])


def _require_own_tenant(principal: Principal, tenant_id: str) -> None:
    if principal.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail={"error": "tenant_mismatch"})


async def _grant_creator_admin_membership(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, principal: Principal
) -> None:
    """RBAC bootstrap (PLAT-TASK-004): the workspace creator becomes its
    first admin member immediately, active (not pending) -- there's no
    invite-acceptance round trip for your own workspace. `.invalid` is
    IANA-reserved (RFC 2606) for exactly this kind of non-routable
    placeholder; the JWT carries no real email claim to invite with.
    """
    placeholder_email = f"{principal.sub}@workspace-owner.invalid"
    await invite_member(
        conn, tenant_id=tenant_id, workspace_id=workspace_id, email=placeholder_email, role="admin"
    )
    await activate_member(
        conn, workspace_id=workspace_id, email=placeholder_email, user_sub=principal.sub
    )


@router.get("/tenants/{tenant_id}/workspaces", response_model=list[WorkspaceResponse])
async def list_workspaces_route(
    tenant_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> list[WorkspaceResponse]:
    _require_own_tenant(principal, tenant_id)
    async with tenant_connection(tenant_id) as conn:
        workspaces = await list_workspaces(conn, tenant_id=tenant_id)
    return [WorkspaceResponse(**workspace.model_dump()) for workspace in workspaces]


@router.post("/tenants/{tenant_id}/workspaces", status_code=201, response_model=WorkspaceResponse)
async def create_workspace_route(
    tenant_id: str,
    body: CreateWorkspaceRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> WorkspaceResponse:
    _require_own_tenant(principal, tenant_id)
    async with tenant_connection(tenant_id) as conn:
        try:
            workspace = await create_workspace(
                conn, tenant_id=tenant_id, slug=body.slug, display_name=body.display_name
            )
        except WorkspaceSlugTaken as exc:
            raise HTTPException(
                status_code=409, detail={"error": "workspace_slug_taken"}
            ) from exc
        await _grant_creator_admin_membership(
            conn, tenant_id=tenant_id, workspace_id=workspace.id, principal=principal
        )
        # PLAT-V1-TASK-010 AC-2: seed the fixed default dashboard tiles for
        # this tenant. Idempotent (ON CONFLICT DO NOTHING) -- a no-op on the
        # tenant's 2nd+ workspace, real work only on its first.
        await seed_tenant_default_tiles(conn, tenant_id=tenant_id)
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type="workspace.created",
                actor_iri=principal.principal_iri,
                subject_iri=workspace.named_graph_iri,
                payload={"slug": workspace.slug},
            ),
        )
    return WorkspaceResponse(**workspace.model_dump())


@router.post("/workspaces/{workspace_id}/members", status_code=202, response_model=MemberResponse)
async def invite_member_route(
    workspace_id: str,
    body: InviteMemberRequest,
    principal: Annotated[Principal, Depends(require_workspace_role("admin"))],
    gateway: Annotated[InviteGateway, Depends(get_invite_gateway)],
) -> MemberResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            member = await invite_member(
                conn,
                tenant_id=principal.tenant_id,
                workspace_id=workspace_id,
                email=body.email,
                role=body.role,
            )
        except MemberAlreadyActive as exc:
            raise HTTPException(
                status_code=409, detail={"error": "member_already_active"}
            ) from exc
        await gateway.send_invite(email=body.email, workspace_id=workspace_id, role=body.role)
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type="member.invited",
                actor_iri=principal.principal_iri,
                subject_iri=f"mailto:{body.email}",
                payload={"role": body.role, "workspace_id": workspace_id},
            ),
        )
    return MemberResponse(**member.model_dump())


@router.get("/workspaces/{workspace_id}/members", response_model=MemberListResponse)
async def list_members_route(
    workspace_id: str,
    principal: Annotated[Principal, Depends(require_workspace_role("read"))],
) -> MemberListResponse:
    """TASK-030 AC-1: settings' Members list. `require_workspace_role("read")`
    is the same dependency `invite_member_route`/`revoke_member_route` use --
    a foreign/nonexistent `workspace_id` 404s (the router's established
    anti-enumeration convention, PR #11 finding 2) rather than 403, so this
    route never leaks a foreign workspace's existence either.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        members = await list_for_workspace(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
    return MemberListResponse(members=members)


@router.delete("/workspaces/{workspace_id}/members/{user_sub}", status_code=204)
async def revoke_member_route(
    workspace_id: str,
    user_sub: str,
    principal: Annotated[Principal, Depends(require_workspace_role("admin"))],
) -> Response:
    async with tenant_connection(principal.tenant_id) as conn:
        removed = await revoke_member(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id, user_sub=user_sub
        )
        if removed:
            await bump_session_version(principal.tenant_id, user_sub)
            await default_audit_emitter.emit(
                conn,
                AuditEvent(
                    tenant_id=principal.tenant_id,
                    event_type="member.revoked",
                    actor_iri=principal.principal_iri,
                    subject_iri=human_principal_iri(user_sub),
                    payload={"workspace_id": workspace_id},
                ),
            )
    return Response(status_code=204)


@router.get("/workspaces/active")
async def active_workspace_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> dict[str, str | None]:
    """The caller's active workspace id (session state, Redis) -- None when
    they have never switched (callers treat that as the seed default)."""
    workspace_id = await get_active_workspace(principal.tenant_id, principal.sub)
    return {"workspace_id": workspace_id}


@router.post("/workspaces/{workspace_id}/switch", response_model=SwitchWorkspaceResponse)
async def switch_workspace_route(
    workspace_id: str,
    # QA FAIL remediation (AC-3): must be an active member to switch in --
    # previously any authenticated tenant principal could, membership or not.
    principal: Annotated[Principal, Depends(require_workspace_role("read"))],
) -> SwitchWorkspaceResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        workspace = await get_workspace(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
        if workspace is None:
            raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})
        await set_active_workspace(principal.tenant_id, principal.sub, workspace_id)
    return SwitchWorkspaceResponse(
        workspace_id=workspace.id,
        named_graph_iri=workspace.named_graph_iri,
        redirect_url=f"/w/{workspace.slug}",
    )
