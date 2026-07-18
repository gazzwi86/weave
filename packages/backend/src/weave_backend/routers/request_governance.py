"""AC-1..AC-8 (BE-TASK-004, build-engine EPIC-001): `GET .../blast-radius`,
`GET .../cost-estimate`, `POST .../sign-off` -- Request Studio's governance
gate. Split out from `routers/requests.py` (drafting/intake) to keep both
files under the Law E 300-line file budget.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.ce_version_client import CeVersionUnavailable, get_ce_client
from weave_backend.projects.governance import NewProjectShell, create_project_shell
from weave_backend.projects.model import ProjectExists, find_existing_project_iri, slugify
from weave_backend.requests.ce_read import (
    CeReadUnavailable,
    compute_blast_radius,
    extract_entity_iris,
    resolve_required_stakeholders,
)
from weave_backend.requests.cost import estimate_spec_cost, resolve_cost_cap
from weave_backend.requests.sign_off import (
    SignOffFields,
    get_approved_stakeholder_iris,
    record_sign_off,
)
from weave_backend.requests.store import RequestRecord
from weave_backend.routers.requests import _get_record_or_404, _update_record
from weave_backend.schemas.requests import (
    ALLOWED_SIGN_OFF_ACTIONS,
    BlastRadiusResponse,
    CostEstimateResponse,
    SignOffBody,
    SignOffResponse,
)

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.get("/{request_id}/blast-radius", response_model=BlastRadiusResponse)
async def get_blast_radius_route(
    request_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> BlastRadiusResponse:
    """AC-1/AC-2."""
    record = await _get_record_or_404(request_id, principal.tenant_id)
    entity_iris = extract_entity_iris(record.draft_content)
    try:
        domains, services = await compute_blast_radius(entity_iris)
    except CeReadUnavailable:
        await _update_record(request_id, blast_radius_status="unavailable")
        return BlastRadiusResponse(status="unavailable", message="review manually")
    await _update_record(request_id, blast_radius_status="computed")
    return BlastRadiusResponse(
        status="computed", domains=domains, services=services, entity_count=len(entity_iris)
    )


@router.get("/{request_id}/cost-estimate", response_model=CostEstimateResponse)
async def get_cost_estimate_route(
    request_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> CostEstimateResponse:
    """AC-3."""
    record = await _get_record_or_404(request_id, principal.tenant_id)
    async with tenant_connection(principal.tenant_id) as conn:
        cap_usd, cap_level = await resolve_cost_cap(conn, tenant_id=principal.tenant_id)
    estimate_usd = estimate_spec_cost(record.draft_content)
    return CostEstimateResponse(
        estimate_usd=estimate_usd,
        cap_usd=cap_usd,
        cap_level=cap_level,
        exceeds_cap=estimate_usd > cap_usd,
    )


def _validate_sign_off_action(body: SignOffBody) -> None:
    if body.action not in ALLOWED_SIGN_OFF_ACTIONS:
        raise HTTPException(
            status_code=422, detail={"error": "validation_error", "field": "action"}
        )
    if body.action == "reject" and not (body.rejection_reason or "").strip():
        raise HTTPException(
            status_code=422, detail={"error": "validation_error", "field": "rejection_reason"}
        )


def _check_blast_radius_gate(record: RequestRecord, body: SignOffBody) -> None:
    """AC-7."""
    if record.blast_radius_status == "unavailable" and not body.blast_radius_acknowledged:
        raise HTTPException(status_code=422, detail={"error": "blast_radius_not_acknowledged"})


async def _check_cost_cap(conn: asyncpg.Connection, record: RequestRecord, tenant_id: str) -> None:
    """AC-4."""
    cap_usd, _level = await resolve_cost_cap(conn, tenant_id=tenant_id)
    estimate_usd = estimate_spec_cost(record.draft_content)
    if estimate_usd > cap_usd:
        raise HTTPException(
            status_code=403,
            detail={"error": "cost_cap_exceeded", "cap_usd": cap_usd, "estimate_usd": estimate_usd},
        )


def _check_not_self_approval(record: RequestRecord, principal: Principal) -> None:
    """Design decision B4: the request's original submitter can't also be
    the stakeholder who approves it. Reject is left ungated -- rejecting
    your own request causes no governance bypass.
    """
    if principal.principal_iri == record.created_by_iri:
        raise HTTPException(status_code=403, detail={"error": "self_approval_not_permitted"})


def _project_name_from_prompt(prompt: str) -> str:
    """ponytail: the brief says "pass the request name as the project
    name", but a `RequestRecord` has no separate `name` field -- only the
    free-text `prompt` it was drafted from (ADR-003). First 120 chars
    (matching `CreateProjectRequest.name`'s own `max_length`) is the lazy,
    honest stand-in.
    """
    return prompt.strip()[:120] or "untitled-request"


async def _auto_create_project(
    conn: asyncpg.Connection,
    *,
    principal: Principal,
    record: RequestRecord,
    ce_client: httpx.AsyncClient,
    headers: dict[str, str] | None = None,
) -> str:
    """AC-5 + design decision table: auto-create via TASK-001's
    `projects/model.py` in-process ("same service, no circular dep") --
    not an HTTP self-call.

    Design decision B9: prefer the request's own `name`/`target_repo_name`
    (TASK-024 AC-1/AC-5 fields) over the `prompt`-derived slug -- the
    prompt fallback only fires for pre-TASK-024 records that never
    captured a name. Takes the whole `record` (not separate prompt/name/
    target_repo_name params) to stay under Law E's 5-param budget; takes
    `principal` (not a separate `tenant_id`/`actor_iri` pair) for the same
    reason -- both are already on it.
    """
    tenant_id = principal.tenant_id
    name = record.name.strip() or _project_name_from_prompt(record.prompt)
    slug = slugify(name)
    existing = await find_existing_project_iri(conn, tenant_id=tenant_id, slug=slug)
    if existing is not None:
        return existing
    # ADR-009 Decision #1: same shared create-shell as direct create
    # (`routers/projects.py::create_project_route`) -- CE-pin +
    # governance-cascade resolution can't drift between the two paths.
    try:
        project, _governance = await create_project_shell(
            conn,
            ce_client=ce_client,
            fields=NewProjectShell(
                tenant_id=tenant_id,
                slug=slug,
                name=name,
                repo_name_hint=record.target_repo_name,
            ),
            actor_iri=principal.principal_iri,
            headers=headers,
        )
    except ProjectExists as exc:
        return exc.existing_iri
    return project.project_iri


async def _process_approval(
    conn: asyncpg.Connection,
    record: RequestRecord,
    principal: Principal,
    ce_client: httpx.AsyncClient,
    headers: dict[str, str] | None = None,
) -> SignOffResponse:
    # request_id: use record.request_id, not a separate param -- the record
    # was fetched by that same id (Law E: keeps params <= 5 room for
    # `headers`, the CE-VERSION-1 auth forward).
    request_id = record.request_id
    _check_not_self_approval(record, principal)
    await record_sign_off(
        conn,
        SignOffFields(
            tenant_id=principal.tenant_id,
            request_id=request_id,
            stakeholder_iri=principal.principal_iri,
            action="approved",
        ),
    )
    entity_iris = extract_entity_iris(record.draft_content)
    required = await resolve_required_stakeholders(entity_iris)
    approved = await get_approved_stakeholder_iris(
        conn, tenant_id=principal.tenant_id, request_id=request_id
    )
    remaining = [iri for iri in required if iri not in approved]
    if remaining:
        return SignOffResponse(status="pending_approvals", remaining=remaining)

    # Implementation hint: a failed auto-create must not mark the request
    # approved -- surface the error and leave it in the sign-off pending state.
    try:
        project_iri = await _auto_create_project(
            conn,
            principal=principal,
            record=record,
            ce_client=ce_client,
            headers=headers,
        )
    except CeVersionUnavailable as exc:
        raise HTTPException(
            status_code=503, detail={"error": "project_creation_unavailable"}
        ) from exc
    await _update_record(request_id, status="approved", project_iri=project_iri)
    return SignOffResponse(status="approved", project_iri=project_iri)


@router.post("/{request_id}/sign-off", response_model=SignOffResponse)
async def submit_sign_off_route(
    request_id: str,
    body: SignOffBody,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[httpx.AsyncClient, Depends(get_ce_client)],
    authorization: Annotated[str | None, Header()] = None,
) -> SignOffResponse:
    """AC-4..AC-7."""
    _validate_sign_off_action(body)
    record = await _get_record_or_404(request_id, principal.tenant_id)
    _check_blast_radius_gate(record, body)

    async with tenant_connection(principal.tenant_id) as conn:
        await _check_cost_cap(conn, record, principal.tenant_id)

        if body.action == "reject":
            await record_sign_off(
                conn,
                SignOffFields(
                    tenant_id=principal.tenant_id,
                    request_id=request_id,
                    stakeholder_iri=principal.principal_iri,
                    action="rejected",
                    rejection_reason=body.rejection_reason,
                ),
            )
            await _update_record(request_id, status="Draft")
            return SignOffResponse(
                status="returned_to_draft", rejection_reason=body.rejection_reason
            )

        headers = {"Authorization": authorization} if authorization else None
        return await _process_approval(conn, record, principal, ce_client, headers)
