"""AC-2/AC-3: TypedResult FAIL classification, per-class retry-ceiling
increment, and ceiling-hit HITL routing (BE-TASK-005, build-engine
EPIC-006).
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from weave_backend.build import store
from weave_backend.build.store import TaskNotFound
from weave_backend.build.typed_result import AgentResultContext, handle_agent_result
from weave_backend.schemas.tasks import FailureClass, TypedResult


class _FakeAuditEmitter:
    def __init__(self) -> None:
        self.events: list[Any] = []

    async def emit(self, conn: Any, event: Any) -> None:
        self.events.append(event)


@pytest.fixture(autouse=True)
def _reset_store() -> None:
    store.reset_for_tests()


def _fail_result(failure_class: FailureClass) -> TypedResult:
    return TypedResult(
        status="FAIL", failure_class=failure_class, evidence="boom", retry_recommended=True
    )


async def test_fail_result_increments_retry_counter_per_failure_class() -> None:
    store.create_task("t1", "task-1")
    emitter = _FakeAuditEmitter()
    fire_hitl_gate_fn = AsyncMock()

    outcome = await handle_agent_result(
        None,
        AgentResultContext(
            tenant_id="t1",
            actor_iri="urn:weave:principal:agent:a1",
            task_id="task-1",
            result=_fail_result("logic"),
        ),
        audit_emitter=emitter,
        fire_hitl_gate_fn=fire_hitl_gate_fn,
    )

    assert outcome == {"action": "retry", "retry_count": 1}
    task = store.get_task("t1", "task-1")
    assert task is not None
    assert task.retry_counts == {"logic": 1}
    assert task.last_agent_principal_iri == "urn:weave:principal:agent:a1"
    assert emitter.events[0].payload == {
        "status": "FAIL",
        "failure_class": "logic",
        "evidence": "boom",
    }
    fire_hitl_gate_fn.assert_not_called()


async def test_ceiling_reached_routes_to_hitl_not_retry() -> None:
    store.create_task("t1", "task-2")
    emitter = _FakeAuditEmitter()
    fire_hitl_gate_fn = AsyncMock()

    # Default ceiling for "spec_ambiguity" is 1 -- the second FAIL trips it.
    await handle_agent_result(
        None,
        AgentResultContext(
            tenant_id="t1",
            actor_iri="a1",
            task_id="task-2",
            result=_fail_result("spec_ambiguity"),
        ),
        audit_emitter=emitter,
        fire_hitl_gate_fn=fire_hitl_gate_fn,
    )
    outcome = await handle_agent_result(
        None,
        AgentResultContext(
            tenant_id="t1",
            actor_iri="a1",
            task_id="task-2",
            result=_fail_result("spec_ambiguity"),
        ),
        audit_emitter=emitter,
        fire_hitl_gate_fn=fire_hitl_gate_fn,
    )

    assert outcome == {"action": "hitl_gate", "retry_count": None}
    fire_hitl_gate_fn.assert_awaited_once()
    task = store.get_task("t1", "task-2")
    assert task is not None
    assert task.status == "Blocked"
    assert task.blocked_reason == "ceiling_hit"


async def test_pass_result_marks_task_assess_passed() -> None:
    store.create_task("t1", "task-3")
    emitter = _FakeAuditEmitter()

    outcome = await handle_agent_result(
        None,
        AgentResultContext(
            tenant_id="t1",
            actor_iri="a1",
            task_id="task-3",
            result=TypedResult(status="PASS", retry_recommended=False),
        ),
        audit_emitter=emitter,
    )

    assert outcome == {"action": "proceed", "retry_count": None}
    task = store.get_task("t1", "task-3")
    assert task is not None
    assert task.status == "ASSESS_PASSED"


async def test_result_for_unknown_task_raises_not_found() -> None:
    with pytest.raises(TaskNotFound):
        await handle_agent_result(
            None,
            AgentResultContext(
                tenant_id="t1", actor_iri="a1", task_id="missing", result=_fail_result("logic")
            ),
        )


def test_fail_result_requires_failure_class() -> None:
    with pytest.raises(ValueError, match="failure_class"):
        TypedResult(status="FAIL", retry_recommended=True)


@pytest.mark.parametrize("failure_class", ["logic", "syntax", "dependency", "spec_ambiguity"])
async def test_fail_result_classifies_first_submission_as_retry_for_every_class(
    failure_class: FailureClass,
) -> None:
    """Edge case: every `TypedResult.failure_class` literal (not just the two
    the happy-path tests happen to use) must classify and increment its own
    counter -- a first FAIL is always under-ceiling (every default ceiling
    is >= 1), so the action is always "retry", never "hitl_gate".
    """
    store.create_task("t1", f"task-{failure_class}")
    fire_hitl_gate_fn = AsyncMock()

    outcome = await handle_agent_result(
        None,
        AgentResultContext(
            tenant_id="t1",
            actor_iri="a1",
            task_id=f"task-{failure_class}",
            result=_fail_result(failure_class),
        ),
        audit_emitter=_FakeAuditEmitter(),
        fire_hitl_gate_fn=fire_hitl_gate_fn,
    )

    assert outcome == {"action": "retry", "retry_count": 1}
    task = store.get_task("t1", f"task-{failure_class}")
    assert task is not None
    assert task.retry_counts == {failure_class: 1}
    fire_hitl_gate_fn.assert_not_called()
