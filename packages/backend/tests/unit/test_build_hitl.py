"""AC-4/AC-5/AC-6: HITL gate fail-closed semantics, PLAT-NOTIFY-1 fan-out,
and no-self-approval enforcement via PLAT-IDENTITY-1 (BE-TASK-005,
build-engine EPIC-006).
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from weave_backend.build import store
from weave_backend.build.hitl import (
    HitlGateClosedError,
    HitlGateContext,
    HitlResponseContext,
    SelfApprovalNotPermitted,
    fire_hitl_gate,
    handle_hitl_response,
)


class _FakeAuditEmitter:
    def __init__(self) -> None:
        self.events: list[Any] = []

    async def emit(self, conn: Any, event: Any) -> None:
        self.events.append(event)


class _FakePrincipal:
    def __init__(self, iri: str) -> None:
        self.iri = iri


@pytest.fixture(autouse=True)
def _reset_store() -> None:
    store.reset_for_tests()


async def test_hitl_gate_fail_closed_on_audit_outage() -> None:
    health_check = AsyncMock(return_value=False)
    notify = AsyncMock()

    with pytest.raises(HitlGateClosedError):
        await fire_hitl_gate(
            None,
            HitlGateContext(
                tenant_id="t1",
                task_id="task-1",
                submitting_principal_iri="urn:weave:principal:agent:a1",
                evidence="boom",
            ),
            health_check=health_check,
            notify=notify,
        )

    notify.assert_awaited_once()
    _, kwargs = notify.call_args
    assert kwargs["event_type"] == "audit_outage"


async def test_hitl_gate_fires_notify_when_audit_healthy() -> None:
    health_check = AsyncMock(return_value=True)
    notify = AsyncMock()

    await fire_hitl_gate(
        None,
        HitlGateContext(
            tenant_id="t1",
            task_id="task-1",
            submitting_principal_iri="urn:weave:principal:agent:a1",
            evidence="boom",
        ),
        health_check=health_check,
        notify=notify,
    )

    notify.assert_awaited_once()
    _, kwargs = notify.call_args
    assert kwargs["event_type"] == "hitl_gate"
    assert kwargs["payload"]["task_id"] == "task-1"


async def test_no_self_approval_enforced_via_plat_identity() -> None:
    store.create_task("t1", "task-1")
    store.set_last_agent_principal("t1", "task-1", "urn:weave:principal:agent:a1")
    resolve_principal = AsyncMock(return_value=_FakePrincipal("urn:weave:principal:agent:a1"))

    with pytest.raises(SelfApprovalNotPermitted):
        await handle_hitl_response(
            None,
            HitlResponseContext(
                tenant_id="t1",
                task_id="task-1",
                approving_principal_iri="urn:weave:principal:agent:a1",
                action="approve",
            ),
            resolve_principal=resolve_principal,
        )


async def test_hitl_approve_resumes_task_to_in_progress() -> None:
    store.create_task("t1", "task-2")
    store.set_last_agent_principal("t1", "task-2", "urn:weave:principal:agent:a1")
    resolve_principal = AsyncMock(return_value=_FakePrincipal("urn:weave:principal:user:u1"))
    emitter = _FakeAuditEmitter()

    outcome = await handle_hitl_response(
        None,
        HitlResponseContext(
            tenant_id="t1",
            task_id="task-2",
            approving_principal_iri="urn:weave:principal:user:u1",
            action="approve",
        ),
        resolve_principal=resolve_principal,
        audit_emitter=emitter,
    )

    assert outcome == {"action": "resumed"}
    task = store.get_task("t1", "task-2")
    assert task is not None
    assert task.status == "In Progress"


async def test_hitl_reject_halts_task_as_blocked() -> None:
    store.create_task("t1", "task-3")
    store.set_last_agent_principal("t1", "task-3", "urn:weave:principal:agent:a1")
    resolve_principal = AsyncMock(return_value=_FakePrincipal("urn:weave:principal:user:u1"))

    outcome = await handle_hitl_response(
        None,
        HitlResponseContext(
            tenant_id="t1",
            task_id="task-3",
            approving_principal_iri="urn:weave:principal:user:u1",
            action="reject",
        ),
        resolve_principal=resolve_principal,
        audit_emitter=_FakeAuditEmitter(),
    )

    assert outcome == {"action": "halted"}
    task = store.get_task("t1", "task-3")
    assert task is not None
    assert task.status == "Blocked"
    assert task.blocked_reason == "hitl_rejected"


async def test_hitl_amend_transitions_task_to_draft() -> None:
    store.create_task("t1", "task-4")
    store.set_last_agent_principal("t1", "task-4", "urn:weave:principal:agent:a1")
    resolve_principal = AsyncMock(return_value=_FakePrincipal("urn:weave:principal:user:u1"))

    outcome = await handle_hitl_response(
        None,
        HitlResponseContext(
            tenant_id="t1",
            task_id="task-4",
            approving_principal_iri="urn:weave:principal:user:u1",
            action="amend",
            amendment="replan the approach",
        ),
        resolve_principal=resolve_principal,
        audit_emitter=_FakeAuditEmitter(),
    )

    assert outcome == {"action": "replan"}
    task = store.get_task("t1", "task-4")
    assert task is not None
    assert task.status == "Draft"
