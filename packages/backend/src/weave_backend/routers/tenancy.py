"""AC-1/AC-2/AC-3/AC-7: workspace + membership management."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.tenancy import (
    CreateWorkspaceRequest,
    InviteMemberRequest,
    MemberResponse,
    SwitchWorkspaceResponse,
    WorkspaceResponse,
)
from weave_backend.tenancy.invite_gateway import InviteGateway, get_invite_gateway
from weave_backend.tenancy.members import MemberAlreadyActive, invite_member, revoke_member
from weave_backend.tenancy.session_guard import require_active_session
from weave_backend.tenancy.sessions import bump_session_version, set_active_workspace
from weave_backend.tenancy.workspaces import (
    WorkspaceSlugTaken,
    create_workspace,
    get_workspace,
)

router = APIRouter(prefix="/api", tags=["tenancy"])


def _require_own_tenant(principal: Principal, tenant_id: str) -> None:
    if principal.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail={"error": "tenant_mismatch"})


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
    principal: Annotated[Principal, Depends(get_current_principal)],
    gateway: Annotated[InviteGateway, Depends(get_invite_gateway)],
) -> MemberResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        workspace = await get_workspace(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
        if workspace is None:
            raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})
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


@router.delete("/workspaces/{workspace_id}/members/{user_sub}", status_code=204)
async def revoke_member_route(
    workspace_id: str,
    user_sub: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> Response:
    async with tenant_connection(principal.tenant_id) as conn:
        workspace = await get_workspace(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
        if workspace is None:
            raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})
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
                    subject_iri=f"urn:weave:principal:{user_sub}",
                    payload={"workspace_id": workspace_id},
                ),
            )
    return Response(status_code=204)


@router.post("/workspaces/{workspace_id}/switch", response_model=SwitchWorkspaceResponse)
async def switch_workspace_route(
    workspace_id: str,
    principal: Annotated[Principal, Depends(require_active_session)],
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
