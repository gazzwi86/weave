"""AC-6/AC-7/AC-8: the ceremony's HITL approval side -- fail-closed on audit
outage, no-self-approval across acting principals, approve-blocked on a
critical finding, and the `ceremony_approved` audit emission (BE-TASK-008,
build-engine EPIC-012).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.build.ceremony_approval import (
    ApproveBlockedByCriticalFinding,
    CeremonyApprovalContext,
    handle_ceremony_approval,
    resolve_acting_principals,
)
from weave_backend.build.hitl import HitlGateClosedError, SelfApprovalNotPermitted

_CTX = CeremonyApprovalContext(
    tenant_id="t1",
    project_iri="p1",
    run_id="r1",
    approving_principal_iri="urn:weave:principal:user:u1",
    action="approve",
)


async def test_should_keep_gate_closed_on_audit_outage() -> None:
    with pytest.raises(HitlGateClosedError):
        await handle_ceremony_approval(
            None, _CTX, acting_principals=frozenset(), health_check=AsyncMock(return_value=False)
        )


async def test_should_reject_self_approval_of_ceremony() -> None:
    with pytest.raises(SelfApprovalNotPermitted):
        await handle_ceremony_approval(
            None,
            _CTX,
            acting_principals=frozenset({"urn:weave:principal:user:u1"}),
            health_check=AsyncMock(return_value=True),
        )


async def test_should_block_approve_when_approve_blocked_is_set() -> None:
    """AC-3 enforced server-side: a blocked Approve raises, but the caller
    can still route Amend/Reject through the same function.
    """
    ctx = CeremonyApprovalContext(
        tenant_id="t1",
        project_iri="p1",
        run_id="r1",
        approving_principal_iri="urn:weave:principal:user:u1",
        action="approve",
        approve_blocked=True,
    )

    with pytest.raises(ApproveBlockedByCriticalFinding):
        await handle_ceremony_approval(
            None, ctx, acting_principals=frozenset(), health_check=AsyncMock(return_value=True)
        )


async def test_should_persist_phase_summary_and_audit_approval() -> None:
    """AC-8: a clean approve records `ceremony_approved` with the approver
    principal via the shared `record_gate` seam.
    """
    with patch("weave_backend.build.ceremony_approval.record_gate", AsyncMock()) as record_gate:
        outcome = await handle_ceremony_approval(
            None, _CTX, acting_principals=frozenset(), health_check=AsyncMock(return_value=True)
        )

    assert outcome == {"ceremony": "resumed"}
    record_gate.assert_awaited_once()
    record = record_gate.call_args.args[1]
    assert record.event_type == "ceremony_approved"
    assert record.actor_iri == "urn:weave:principal:user:u1"


async def test_should_amend_a_blocked_approve_without_raising() -> None:
    ctx = CeremonyApprovalContext(
        tenant_id="t1",
        project_iri="p1",
        run_id="r1",
        approving_principal_iri="urn:weave:principal:user:u1",
        action="amend",
        approve_blocked=True,
    )

    with patch("weave_backend.build.ceremony_approval.record_gate", AsyncMock()):
        outcome = await handle_ceremony_approval(
            None, ctx, acting_principals=frozenset(), health_check=AsyncMock(return_value=True)
        )

    assert outcome == {"ceremony": "replan"}


async def test_resolve_acting_principals_queries_audit_entries_by_target() -> None:
    conn = AsyncMock()
    conn.fetch = AsyncMock(
        return_value=[{"actor_principal_iri": "urn:weave:principal:agent:a1"}]
    )

    principals = await resolve_acting_principals(
        conn, tenant_id="t1", target_iris=frozenset({"urn:weave:build:task:t1"})
    )

    assert principals == frozenset({"urn:weave:principal:agent:a1"})
    conn.fetch.assert_awaited_once()


async def test_resolve_acting_principals_empty_target_set_short_circuits() -> None:
    conn = AsyncMock()

    principals = await resolve_acting_principals(conn, tenant_id="t1", target_iris=frozenset())

    assert principals == frozenset()
    conn.fetch.assert_not_awaited()
