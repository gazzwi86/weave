"""AC-2/AC-6/AC-7: agent-token minting, admin principal lookup, and the
tenant-scoped agent registry listing.
"""

from __future__ import annotations

from time import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.agent import (
    AGENT_TOKEN_TTL_SECONDS,
    StsValidationError,
    get_caller_identity_arn,
    sign_agent_token,
)
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.auth.public import public
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import (
    PrincipalNotFound,
    agent_principal_iri,
    agent_sub,
    ensure_agent_principal,
    get_principal,
    list_tenant_agents,
    resolve_workspace_tenant,
)
from weave_backend.rate_limit import check_rate_limit
from weave_backend.rbac import enforce_workspace_role, require_tenant_admin
from weave_backend.schemas.identity import (
    AgentListResponse,
    AgentSummaryResponse,
    AgentTokenRequest,
    AgentTokenResponse,
    PrincipalResponse,
    WorkspaceMembershipResponse,
)

router = APIRouter(prefix="/api", tags=["identity"])

# Law 18: shared across requests to this process -- see rate_limit.py.
_agent_token_rate_limit_store: dict[str, list[float]] = {}


def _enforce_agent_token_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(_agent_token_rate_limit_store, client_ip, time()):
        raise HTTPException(status_code=429, detail={"error": "rate_limited"})


@router.post("/auth/agent-token", response_model=AgentTokenResponse)
@public
async def mint_agent_token(
    body: AgentTokenRequest,
    _rate_limited: Annotated[None, Depends(_enforce_agent_token_rate_limit)],
) -> AgentTokenResponse:
    try:
        iam_role_arn = await get_caller_identity_arn(body.sts_token)
    except StsValidationError as exc:
        raise HTTPException(
            status_code=401, detail={"error": "sts_validation_failed"}
        ) from exc

    tenant_id = await resolve_workspace_tenant(workspace_id=body.workspace_id)
    if tenant_id is None:
        raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})

    iri = agent_principal_iri(iam_role_arn)
    sub = agent_sub(iam_role_arn)
    async with tenant_connection(tenant_id) as conn:
        await ensure_agent_principal(
            conn,
            tenant_id=tenant_id,
            workspace_id=body.workspace_id,
            iam_role_arn=iam_role_arn,
            display_name=iam_role_arn,
        )
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type="agent.registered",
                actor_iri=iri,
                subject_iri=iri,
                payload={"workspace_id": body.workspace_id, "iam_role_arn": iam_role_arn},
            ),
        )

    agent_token = sign_agent_token(sub=sub, tenant_id=tenant_id, principal_iri=iri)
    return AgentTokenResponse(
        agent_token=agent_token, principal_iri=iri, expires_in=AGENT_TOKEN_TTL_SECONDS
    )


@router.get("/principals/{iri}", response_model=PrincipalResponse)
async def get_principal_route(
    iri: str,
    principal: Annotated[Principal, Depends(require_tenant_admin)],
) -> PrincipalResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            record = await get_principal(conn, tenant_id=principal.tenant_id, iri=iri)
        except PrincipalNotFound as exc:
            raise HTTPException(
                status_code=404, detail={"error": "principal_not_found"}
            ) from exc
    return PrincipalResponse(
        iri=record.iri,
        type=record.type,
        display_name=record.display_name,
        workspace_memberships=[
            WorkspaceMembershipResponse(workspace_id=m.workspace_id, role=m.role)
            for m in record.workspace_memberships
        ],
        created_at=record.created_at,
    )


@router.get("/agents", response_model=AgentListResponse)
async def list_agents_route(
    workspace_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> AgentListResponse:
    # PR #12 review finding 1 (same AC-3 class as settings/sparql/switch):
    # a tenant member with zero membership rows in this workspace could
    # enumerate every agent in it. Read-role membership is now required.
    async with tenant_connection(principal.tenant_id) as conn:
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace_id,
            user_sub=principal.sub,
            min_role="read",
        )
        agents = await list_tenant_agents(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
    return AgentListResponse(
        agents=[
            AgentSummaryResponse(
                iri=a.iri,
                display_name=a.display_name,
                workspace_id=a.workspace_id,
                created_at=a.created_at,
            )
            for a in agents
        ]
    )
