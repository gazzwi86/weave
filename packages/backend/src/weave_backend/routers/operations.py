"""CE-WRITE-1: `POST /api/operations/apply` -- the single validated mutation
entry point (AC-001-01..10). No other route may write to a working graph;
that's the point (single validated entry point, no bypass path).
"""

from __future__ import annotations

import logging
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.operations import outbox
from weave_backend.operations.pipeline import (
    ApplyContext,
    ForeignTargetError,
    InvalidTargetError,
    apply_operations_request,
)
from weave_backend.rbac import InsufficientRole, enforce_workspace_role
from weave_backend.schemas.operations import ApplyRequest, ApplyResponse, ViolationsResponse
from weave_backend.tenancy.sessions import get_active_workspace, get_redis
from weave_backend.tenancy.workspaces import Workspace, get_workspace

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["operations"])

#: Either a successful/violating pipeline outcome, or a denial that must
#: still be raised as an HTTPException -- but only *after* the caller's
#: `async with tenant_connection(...)` block has closed (committed), so the
#: audit entry written alongside the denial survives it (same pattern as
#: `billing.py::_check_budget_gate`/`_raise_cap_reached`: an exception raised
#: while the transaction is still open would roll the audit insert back too).
_ApplyOutcome = ApplyResponse | ViolationsResponse | HTTPException


async def _enforce_write_access(
    conn: asyncpg.Connection, *, principal: Principal, workspace: Workspace, workspace_id: str
) -> HTTPException | None:
    """AC-001-08 (403): returns the denial (never raises) so the caller can
    commit the audit entry written here before the request actually fails.
    """
    try:
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace_id,
            user_sub=principal.sub,
            min_role="author",
        )
    except InsufficientRole as exc:
        # Not `security.*`: that prefix fans out an admin notification (Slack
        # forced) for every hit, and a read-only member hitting a write route
        # is routine, not an escalation-grade event. The audit ENTRY is still
        # mandatory (rbac-multi-tenancy.md) -- just not the alert.
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type="access.rbac.denied",
                actor_iri=principal.principal_iri,
                subject_iri=workspace.named_graph_iri,
                engine="constitution",
                payload={"required_role": "author"},
            ),
        )
        return exc
    return None


async def _reject_foreign_target(
    conn: asyncpg.Connection, *, principal: Principal, target: str
) -> HTTPException:
    """ADR-001-tenant-isolation: a payload naming another tenant's/
    workspace's graph is a 403 + audit, never a 400.
    """
    await default_audit_emitter.emit(
        conn,
        AuditEvent(
            tenant_id=principal.tenant_id,
            event_type="security.cross_tenant.rejected",
            actor_iri=principal.principal_iri,
            subject_iri=target,
            engine="constitution",
            payload={},
        ),
    )
    return HTTPException(status_code=403, detail={"error": "cross_tenant_target"})


async def _run_apply(
    conn: asyncpg.Connection, *, principal: Principal, workspace_id: str, body: ApplyRequest
) -> _ApplyOutcome:
    workspace = await get_workspace(
        conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})

    denied = await _enforce_write_access(
        conn, principal=principal, workspace=workspace, workspace_id=workspace_id
    )
    if denied is not None:
        return denied

    ctx = ApplyContext(
        tenant_id=principal.tenant_id,
        workspace_id=workspace_id,
        named_graph_iri=workspace.named_graph_iri,
        conn=conn,
        principal_iri=principal.principal_iri,
        # Principal.principal_type is a plain str (JWT claim) -- narrow to
        # the PROV-O actor-type literal, defaulting anything unrecognised to
        # "human" rather than trusting an arbitrary claim value.
        principal_type="agent" if principal.principal_type == "agent" else "human",
    )
    try:
        return await apply_operations_request(ctx, body, get_redis())
    except InvalidTargetError as exc:
        # Malformed target -- not a forgery attempt, just a bad request.
        raise HTTPException(status_code=400, detail={"error": "invalid_target"}) from exc
    except ForeignTargetError:
        return await _reject_foreign_target(conn, principal=principal, target=body.target)
    except TimeoutError as exc:
        # Another caller holds this idempotency key's lock and never
        # finished (e.g. its process crashed) -- a clean 409 beats an
        # unhandled TimeoutError surfacing as a 500.
        raise HTTPException(
            status_code=409, detail={"error": "concurrent_apply_in_progress"}
        ) from exc


@router.post(
    "/operations/apply",
    response_model=ApplyResponse,
    status_code=201,
    responses={422: {"model": ViolationsResponse}},
)
async def apply_operations_route(
    body: ApplyRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ApplyResponse | JSONResponse:
    # AC-001-07 (401) is satisfied by the `get_current_principal` dependency
    # itself -- it raises before this body ever runs.
    workspace_id = await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})

    async with tenant_connection(principal.tenant_id) as conn:
        outcome = await _run_apply(
            conn, principal=principal, workspace_id=workspace_id, body=body
        )

    if isinstance(outcome, ApplyResponse):
        # Real hash-chain delivery of the outbox row enqueued inside the
        # mutation's own transaction (ADR-002) -- a fresh connection/
        # transaction, deliberately separate from the one that just
        # committed, so a slow/unavailable audit sink can never roll back
        # the mutation (AC-002-04). This is best-effort: a pool-acquire or
        # SELECT failure here must never 500 an already-committed mutation
        # -- the row stays enqueued, pending, for the next flush.
        try:
            async with tenant_connection(principal.tenant_id) as flush_conn:
                await outbox.flush_pending(flush_conn, principal.tenant_id)
        except Exception:
            log.warning(
                "post-commit outbox flush failed for tenant=%s, will retry next flush",
                principal.tenant_id,
                exc_info=True,
            )

    if isinstance(outcome, HTTPException):
        raise outcome
    if isinstance(outcome, ViolationsResponse):
        # CE-WRITE-1 contract: `422 { violations: [...] }` at the top level --
        # not wrapped in FastAPI's default `{"detail": ...}` envelope, so
        # `HTTPException` (which always wraps) isn't used here.
        return JSONResponse(status_code=422, content=outcome.model_dump())
    return outcome
