"""AC-4/AC-5/AC-6/AC-7: PLAT-AUDIT-1 read/verify/compliance routes.
`GET /api/audit` and `POST /api/audit/verify` are tenant-admin-only (AC-5's
explicit admin requirement, and verifying/reading the raw chain is at least
as sensitive as billing's tenant-wide usage read). `GET /api/audit/compliance`
is open to any authenticated tenant member -- its response shape never
includes `diff_summary`, so there is nothing for a non-admin to leak (AC-7).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.audit.brand_conformance import get_brand_conformance
from weave_backend.audit.compliance import get_compliance_summary
from weave_backend.audit.listing import AuditFilters, list_entries
from weave_backend.audit.verify import verify_chain
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.rbac import require_tenant_admin
from weave_backend.schemas.audit import (
    ActorCountResponse,
    AuditEntriesResponse,
    AuditEntryResponse,
    AuditQueryParams,
    BrandConformanceResponse,
    ComplianceResponse,
    VerifyChainResponse,
)

router = APIRouter(prefix="/api/audit", tags=["audit"])

_PERIOD_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


def _require_own_tenant(principal: Principal, tenant_id: str) -> None:
    if tenant_id != principal.tenant_id:
        raise HTTPException(status_code=403, detail={"error": "tenant_mismatch"})


@router.get("", response_model=AuditEntriesResponse)
async def list_audit_entries_route(
    params: Annotated[AuditQueryParams, Query()],
    principal: Annotated[Principal, Depends(require_tenant_admin)],
) -> AuditEntriesResponse:
    _require_own_tenant(principal, params.tenant_id)
    async with tenant_connection(principal.tenant_id) as conn:
        page_result = await list_entries(
            conn,
            tenant_id=principal.tenant_id,
            page=params.page,
            per_page=params.per_page,
            filters=AuditFilters(
                engine=params.engine,
                event_type=params.event_type,
                actor_principal_iri=params.actor_principal_iri,
                target_iri=params.target_iri,
                date_from=params.date_from,
                date_to=params.date_to,
                q=params.q,
            ),
        )
    return AuditEntriesResponse(
        entries=[AuditEntryResponse(**entry.__dict__) for entry in page_result.entries],
        total=page_result.total,
        page=params.page,
        per_page=params.per_page,
    )


@router.post("/verify", response_model=VerifyChainResponse)
async def verify_chain_route(
    principal: Annotated[Principal, Depends(require_tenant_admin)],
) -> VerifyChainResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        result = await verify_chain(conn, principal.tenant_id)
    return VerifyChainResponse(
        valid=result.valid,
        entries_checked=result.entries_checked,
        first_broken_seq=result.first_broken_seq,
        error=result.error,
    )


@router.get("/compliance", response_model=ComplianceResponse)
async def compliance_view_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    period: Annotated[str | None, Query(pattern=_PERIOD_PATTERN)] = None,
) -> ComplianceResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        summary = await get_compliance_summary(conn, principal.tenant_id, period=period)
    return ComplianceResponse(
        chain_status=summary.chain_status,
        entries_checked=summary.entries_checked,
        first_broken_seq=summary.first_broken_seq,
        by_event_category=summary.by_event_category,
        top_actors=[ActorCountResponse(**actor.__dict__) for actor in summary.top_actors],
        period=summary.period,
        shacl_validated=summary.shacl_validated,
        shacl_rejections=summary.shacl_rejections,
    )


@router.get("/brand-conformance", response_model=BrandConformanceResponse)
async def brand_conformance_view_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    window_days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> BrandConformanceResponse:
    """G14: pass-rate KPI over `gate_result_brand` audit events. Open to any
    authenticated tenant member -- like `/compliance`, this never echoes
    `diff_summary`, so there is nothing for a non-admin to leak.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        summary = await get_brand_conformance(
            conn, principal.tenant_id, window_days=window_days
        )
    return BrandConformanceResponse(**summary.__dict__)
