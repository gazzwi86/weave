"""G15/ADR-023: operator-console cross-tenant endpoints -- list/provision/
suspend companies. Every route is gated by `require_super_admin` (pure JWT,
`rbac.py`) -- the ONE deliberate cross-tenant surface in this codebase, so
every action is audited (ADR-023 point 3: the audit write goes through
`tenant_connection(tenant_id)`, since `audit_entries` stays RLS'd even
though `tenants` itself is not).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal
from weave_backend.db.pool import tenant_connection, untenanted_connection
from weave_backend.operations.aggregate_metrics import entity_count_by_kind, resolve_latest_version
from weave_backend.rbac import require_super_admin
from weave_backend.schemas.operator import (
    CompanyResponse,
    CompanyStatusResponse,
    ProvisionCompanyRequest,
    ProvisionCompanyResponse,
)
from weave_backend.schemas.tenancy import MemberResponse
from weave_backend.settings.scope import company_iri
from weave_backend.tenancy.invite_gateway import InviteGateway, get_invite_gateway
from weave_backend.tenancy.members import invite_member, list_for_workspace
from weave_backend.tenancy.tenants import (
    TenantIdTaken,
    TenantRecord,
    create_tenant,
    list_tenants,
    set_tenant_status,
)
from weave_backend.tenancy.workspaces import create_workspace, list_workspaces

router = APIRouter(prefix="/api/operator", tags=["operator"])

#: G15/ADR-023 point 4: a company IS a single workspace (tenancy realignment
#: decision) -- operator provisioning always mints exactly one, on a fixed
#: slug, same convention as `db/seed_demo.py::WORKSPACE_SLUG`.
WORKSPACE_SLUG = "company"


async def _company_summary(tenant: TenantRecord) -> CompanyResponse:
    """One `tenant_connection` round-trip for the tenant's own workspace
    metadata/membership, plus one Oxigraph read for its entity count
    (ADR-023 consequences) -- a never-provisioned-a-workspace tenant (should
    not happen via this router, but a defensive read) reports zeros.
    """
    async with tenant_connection(tenant.tenant_id) as conn:
        workspaces = await list_workspaces(conn, tenant_id=tenant.tenant_id)
        if not workspaces:
            return CompanyResponse(
                tenant_id=tenant.tenant_id,
                name=tenant.name,
                industry=tenant.industry,
                region=tenant.region,
                member_count=0,
                entity_count=0,
                model_version=None,
                status=tenant.status,
                created_at=tenant.created_at,
            )
        workspace = workspaces[0]
        members = await list_for_workspace(
            conn, tenant_id=tenant.tenant_id, workspace_id=workspace.id
        )
        model_version = await resolve_latest_version(
            conn, tenant_id=tenant.tenant_id, workspace_id=workspace.id
        )
    counts = await entity_count_by_kind(workspace.named_graph_iri)
    return CompanyResponse(
        tenant_id=tenant.tenant_id,
        name=tenant.name,
        industry=tenant.industry,
        region=tenant.region,
        member_count=sum(1 for member in members if member.status == "active"),
        entity_count=sum(counts.values()),
        model_version=model_version,
        status=tenant.status,
        created_at=tenant.created_at,
    )


@router.get("/companies", response_model=list[CompanyResponse])
async def list_companies_route(
    principal: Annotated[Principal, Depends(require_super_admin)],
) -> list[CompanyResponse]:
    del principal  # gate only -- the whole point of this route is cross-tenant
    async with untenanted_connection() as conn:
        tenants = await list_tenants(conn)
    return [await _company_summary(tenant) for tenant in tenants]


@router.post("/companies", status_code=201, response_model=ProvisionCompanyResponse)
async def provision_company_route(
    body: ProvisionCompanyRequest,
    principal: Annotated[Principal, Depends(require_super_admin)],
    gateway: Annotated[InviteGateway, Depends(get_invite_gateway)],
) -> ProvisionCompanyResponse:
    """ADR-023 point 4: synchronous, one transaction -- no framework-kind
    seeding (BPMO is a global SHACL shape set, nothing per-tenant to seed).
    """
    async with untenanted_connection() as conn:
        try:
            tenant = await create_tenant(
                conn, name=body.name, industry=body.industry, region=body.region
            )
        except TenantIdTaken as exc:
            raise HTTPException(status_code=409, detail={"error": "tenant_id_taken"}) from exc

    async with tenant_connection(tenant.tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant.tenant_id, slug=WORKSPACE_SLUG, display_name=tenant.name
        )
        member = await invite_member(
            conn,
            tenant_id=tenant.tenant_id,
            workspace_id=workspace.id,
            email=body.admin_email,
            role="admin",
        )
        await gateway.send_invite(email=body.admin_email, workspace_id=workspace.id, role="admin")
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant.tenant_id,
                event_type="company.provisioned",
                actor_iri=principal.principal_iri,
                subject_iri=company_iri(tenant.tenant_id),
                payload={"name": tenant.name, "admin_email": body.admin_email},
            ),
        )
    return ProvisionCompanyResponse(
        company=CompanyResponse(
            tenant_id=tenant.tenant_id,
            name=tenant.name,
            industry=tenant.industry,
            region=tenant.region,
            member_count=0,
            entity_count=0,
            model_version=None,
            status=tenant.status,
            created_at=tenant.created_at,
        ),
        admin_invite=MemberResponse(**member.model_dump()),
    )


async def _set_company_status(
    tenant_id: str, *, status: str, principal: Principal, event_type: str
) -> CompanyStatusResponse:
    async with untenanted_connection() as conn:
        tenant = await set_tenant_status(conn, tenant_id=tenant_id, status=status)
    if tenant is None:
        raise HTTPException(status_code=404, detail={"error": "company_not_found"})
    async with tenant_connection(tenant_id) as conn:
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type=event_type,
                actor_iri=principal.principal_iri,
                subject_iri=company_iri(tenant_id),
                payload={"status": status},
            ),
        )
    return CompanyStatusResponse(tenant_id=tenant.tenant_id, status=tenant.status)


@router.post("/companies/{tenant_id}/suspend", response_model=CompanyStatusResponse)
async def suspend_company_route(
    tenant_id: str,
    principal: Annotated[Principal, Depends(require_super_admin)],
) -> CompanyStatusResponse:
    return await _set_company_status(
        tenant_id, status="suspended", principal=principal, event_type="company.suspended"
    )


@router.post("/companies/{tenant_id}/unsuspend", response_model=CompanyStatusResponse)
async def unsuspend_company_route(
    tenant_id: str,
    principal: Annotated[Principal, Depends(require_super_admin)],
) -> CompanyStatusResponse:
    return await _set_company_status(
        tenant_id, status="active", principal=principal, event_type="company.unsuspended"
    )
