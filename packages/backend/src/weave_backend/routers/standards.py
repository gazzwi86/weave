"""TASK-001 (build-engine EPIC-002, E2-S7): `PUT /api/standards/{scope}/{key}`,
`GET /api/standards`, `GET /api/standards/effective` -- company/project
standards catalogue with whole-key project override (ADR-007).

Authz: see `docs/specs/weave/engines/build-engine/decisions/ADR-010.md` --
both scopes gate on `rbac.require_tenant_admin` (no separate "project admin"
concept exists in this codebase; tenant-admin is a fail-closed superset).
"""

from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.briefs.ce_read_client import get_ce_read_client
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.model import get_project
from weave_backend.rbac import require_tenant_admin
from weave_backend.schemas.standards import (
    PutStandardRequest,
    StandardResponse,
    StandardsListResponse,
)
from weave_backend.standards.ce_client import CeReadTransportError, get_entity
from weave_backend.standards.effective import effective_set
from weave_backend.standards.models import StandardRecord
from weave_backend.standards.store import (
    NewStandard,
    ScopeProjectMismatch,
    list_standards,
    load_effective_standards,
    upsert_standard,
    validate_scope_project,
)

router = APIRouter(prefix="/api/standards", tags=["standards"])

_VALID_SCOPES = ("company", "project")
_VALID_STATUSES = ("draft", "active", "retired")
_POLICY_KIND = "Policy"


def _record_to_response(record: StandardRecord) -> StandardResponse:
    return StandardResponse(
        standard_id=record.standard_id,
        scope=record.scope,
        project_id=record.project_id,
        standard_key=record.standard_key,
        title=record.title,
        body_md=record.body_md,
        stack_pins=record.stack_pins,
        policy_iri=record.policy_iri,
        status=record.status,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _validate_scope_and_status(scope: str, status: str, project_id: str | None) -> None:
    if scope not in _VALID_SCOPES:
        raise HTTPException(status_code=422, detail={"error": "invalid_scope"})
    if status not in _VALID_STATUSES:
        raise HTTPException(status_code=422, detail={"error": "invalid_status"})
    try:
        validate_scope_project(scope, project_id)
    except ScopeProjectMismatch as exc:
        raise HTTPException(
            status_code=422, detail={"error": "scope_project_id_mismatch"}
        ) from exc


async def _validate_policy_iri(
    client: httpx.AsyncClient, policy_iri: str, authorization: str | None
) -> None:
    """AC-1/AC-2: resolve `policy_iri` via CE-READ-1 before any persistence.
    404 (or a non-Policy kind) -> 422 `policy_not_found`; CE unreachable ->
    503 `ce_unavailable`. The two are never collapsed (task hint).
    """
    headers = {"Authorization": authorization} if authorization else None
    try:
        entity = await get_entity(client, policy_iri, headers=headers)
    except CeReadTransportError as exc:
        raise HTTPException(status_code=503, detail={"error": "ce_unavailable"}) from exc
    if entity is None or entity.get("kind") != _POLICY_KIND:
        raise HTTPException(status_code=422, detail={"error": "policy_not_found"})


@router.put("/{scope}/{key}", response_model=StandardResponse)
async def put_standard_route(  # noqa: PLR0913 -- Law E waiver, see .claude/state/complexity-waivers.md
    scope: str,
    key: str,
    body: PutStandardRequest,
    principal: Annotated[Principal, Depends(require_tenant_admin)],
    ce_client: Annotated[httpx.AsyncClient, Depends(get_ce_read_client)],
    authorization: Annotated[str | None, Header()] = None,
) -> StandardResponse:
    status = body.status or "draft"
    _validate_scope_and_status(scope, status, body.project_id)

    async with tenant_connection(principal.tenant_id) as conn:
        if scope == "project":
            project = await get_project(
                conn, tenant_id=principal.tenant_id, project_iri=body.project_id or ""
            )
            if project is None:
                raise HTTPException(status_code=404, detail={"error": "project_not_found"})

        await _validate_policy_iri(ce_client, body.policy_iri, authorization)

        record = await upsert_standard(
            conn,
            NewStandard(
                tenant_id=principal.tenant_id,
                scope=scope,
                project_id=body.project_id,
                standard_key=key,
                title=body.title,
                body_md=body.body_md,
                stack_pins=body.stack_pins,
                policy_iri=body.policy_iri,
                status=status,
                created_by=principal.principal_iri,
            ),
        )
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type="standard_upserted",
                actor_iri=principal.principal_iri,
                subject_iri=record.standard_id,
                payload={"scope": scope, "standard_key": key},
            ),
        )
    return _record_to_response(record)


@router.get("", response_model=StandardsListResponse)
async def list_standards_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    scope: str | None = Query(default=None),
    project_id: str | None = Query(default=None),
) -> StandardsListResponse:
    if scope is not None and scope not in _VALID_SCOPES:
        raise HTTPException(status_code=422, detail={"error": "invalid_scope"})
    async with tenant_connection(principal.tenant_id) as conn:
        records = await list_standards(
            conn, tenant_id=principal.tenant_id, scope=scope, project_id=project_id
        )
    return StandardsListResponse(standards=[_record_to_response(r) for r in records])


@router.get("/effective", response_model=StandardsListResponse)
async def effective_standards_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    project_id: str = Query(),
) -> StandardsListResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_id)
        if project is None:
            raise HTTPException(status_code=404, detail={"error": "project_not_found"})
        company, project_docs = await load_effective_standards(
            conn, tenant_id=principal.tenant_id, project_id=project_id
        )
    merged = effective_set(company, project_docs)
    return StandardsListResponse(standards=[_record_to_response(r) for r in merged])
