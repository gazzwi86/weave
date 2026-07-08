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

from weave_backend.audit.compliance import get_compliance_summary
from weave_backend.audit.listing import list_entries
from weave_backend.audit.verify import verify_chain
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.rbac import require_tenant_admin
from weave_backend.schemas.audit import (
    ActorCountResponse,
    AuditEntriesResponse,
    AuditEntryResponse,
    AuditQueryParams,
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
            event_type=params.event_type,
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
