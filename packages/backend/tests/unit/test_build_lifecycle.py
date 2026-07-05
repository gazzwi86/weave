"""AC-1: spec lifecycle FSM (BE-TASK-005, build-engine EPIC-006)."""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.build import store
from weave_backend.build.lifecycle import (
    InvalidTransition,
    SpecNotFound,
    SpecTransition,
    transition_spec,
)


class _FakeAuditEmitter:
    def __init__(self) -> None:
        self.events: list[Any] = []

    async def emit(self, conn: Any, event: Any) -> None:
        self.events.append(event)


@pytest.fixture(autouse=True)
def _reset_store() -> None:
    store.reset_for_tests()


async def test_transition_from_complete_returns_409_invalid_transition() -> None:
    store.create_spec("t1", "spec-1", status="Complete")
    emitter = _FakeAuditEmitter()

    with pytest.raises(InvalidTransition) as exc_info:
        await transition_spec(
            None,
            SpecTransition(
                tenant_id="t1",
                spec_id="spec-1",
                requested_state="Draft",
                actor_iri="urn:weave:principal:user:u1",
            ),
            audit_emitter=emitter,
        )

    assert exc_info.value.current == "Complete"
    assert exc_info.value.requested == "Draft"
    assert emitter.events == []


async def test_transition_draft_to_in_progress_skips_approved() -> None:
    store.create_spec("t1", "spec-2", status="Draft")
    emitter = _FakeAuditEmitter()

    with pytest.raises(InvalidTransition):
        await transition_spec(
            None,
            SpecTransition(
                tenant_id="t1",
                spec_id="spec-2",
                requested_state="In Progress",
                actor_iri="urn:weave:principal:user:u1",
            ),
            audit_emitter=emitter,
        )


async def test_transition_unknown_spec_raises_not_found() -> None:
    with pytest.raises(SpecNotFound):
        await transition_spec(
            None,
            SpecTransition(
                tenant_id="t1",
                spec_id="missing",
                requested_state="Spec Review",
                actor_iri="urn:weave:principal:user:u1",
            ),
        )


async def test_valid_transition_updates_status_and_emits_audit() -> None:
    store.create_spec("t1", "spec-3", status="Draft")
    emitter = _FakeAuditEmitter()

    updated = await transition_spec(
        None,
        SpecTransition(
            tenant_id="t1",
            spec_id="spec-3",
            requested_state="Spec Review",
            actor_iri="urn:weave:principal:user:u1",
        ),
        audit_emitter=emitter,
    )

    assert updated.status == "Spec Review"
    assert len(emitter.events) == 1
    assert emitter.events[0].event_type == "spec_transition"
    assert emitter.events[0].payload == {"from": "Draft", "to": "Spec Review"}
