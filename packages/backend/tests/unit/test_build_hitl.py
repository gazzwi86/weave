"""AC-4/AC-5/AC-6: HITL gate fail-closed semantics, PLAT-NOTIFY-1 fan-out,
and no-self-approval enforcement via PLAT-IDENTITY-1 (BE-TASK-005,
build-engine EPIC-006).
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.build import store
from weave_backend.build.hitl import (
    HitlGateClosedError,
    HitlGateContext,
    HitlResponseContext,
    SelfApprovalNotPermitted,
    default_audit_health_check,
    fire_hitl_gate,
    handle_hitl_response,
)
from weave_backend.build.store import TaskNotFound


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


async def test_hitl_response_for_unknown_task_raises_not_found() -> None:
    """Edge case: `handle_hitl_response` itself (not just the router's mocked
    side_effect in test_tasks_router.py) must reject an unknown task_id.
    """
    resolve_principal = AsyncMock(return_value=_FakePrincipal("urn:weave:principal:user:u1"))

    with pytest.raises(TaskNotFound):
        await handle_hitl_response(
            None,
            HitlResponseContext(
                tenant_id="t1",
                task_id="does-not-exist",
                approving_principal_iri="urn:weave:principal:user:u1",
                action="approve",
            ),
            resolve_principal=resolve_principal,
        )


async def test_hitl_halted_task_can_still_be_replanned() -> None:
    """Edge case: reject (halted) does not brick the task -- a later amend
    (replan) on the same task must still succeed, proving `halted` is not a
    dead end the human is stuck in.
    """
    store.create_task("t1", "task-5")
    store.set_last_agent_principal("t1", "task-5", "urn:weave:principal:agent:a1")
    resolve_principal = AsyncMock(return_value=_FakePrincipal("urn:weave:principal:user:u1"))

    halted = await handle_hitl_response(
        None,
        HitlResponseContext(
            tenant_id="t1",
            task_id="task-5",
            approving_principal_iri="urn:weave:principal:user:u1",
            action="reject",
        ),
        resolve_principal=resolve_principal,
        audit_emitter=_FakeAuditEmitter(),
    )
    assert halted == {"action": "halted"}

    replanned = await handle_hitl_response(
        None,
        HitlResponseContext(
            tenant_id="t1",
            task_id="task-5",
            approving_principal_iri="urn:weave:principal:user:u1",
            action="amend",
            amendment="try a different approach",
        ),
        resolve_principal=resolve_principal,
        audit_emitter=_FakeAuditEmitter(),
    )
    assert replanned == {"action": "replan"}
    task = store.get_task("t1", "task-5")
    assert task is not None
    assert task.status == "Draft"
    assert task.blocked_reason is None


async def test_default_audit_health_check_fails_closed_on_pool_error() -> None:
    """Edge case: exercise the *real* `default_audit_health_check` (the
    function actually wired as `fire_hitl_gate`'s default, not the AsyncMock
    stand-in every other test injects) to prove the fail-closed except
    clause (AC-5) genuinely fires when the pool itself is unreachable.
    """
    with patch(
        "weave_backend.build.hitl.get_app_pool", AsyncMock(side_effect=OSError("no pool"))
    ):
        healthy = await default_audit_health_check()

    assert healthy is False
