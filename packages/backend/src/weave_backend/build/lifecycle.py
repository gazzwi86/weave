"""AC-1: spec lifecycle state machine (BE-TASK-005, build-engine
EPIC-006). `VALID_TRANSITIONS` is the single source of truth -- both the
API handler and any future CLI tool import this same module rather than
re-declaring the FSM.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from weave_backend.audit.emitter import AuditEmitter, AuditEvent, default_audit_emitter
from weave_backend.build import store
from weave_backend.build.store import SpecNotFound, spec_iri

__all__ = ["InvalidTransition", "SpecNotFound", "SpecTransition", "transition_spec"]

VALID_TRANSITIONS: dict[str, set[str]] = {
    "Draft": {"Spec Review"},
    "Spec Review": {"Approved", "Draft"},
    "Approved": {"In Progress"},
    "In Progress": {"Complete", "Blocked"},
    "Blocked": {"In Progress", "Draft"},
    "Complete": set(),
}


class InvalidTransition(Exception):
    """AC-1: the requested transition is not reachable from the spec's
    current state.
    """

    def __init__(self, current: str, requested: str) -> None:
        super().__init__(f"cannot transition from {current!r} to {requested!r}")
        self.current = current
        self.requested = requested


@dataclass(frozen=True)
class SpecTransition:
    tenant_id: str
    spec_id: str
    requested_state: str
    actor_iri: str


async def transition_spec(
    conn: Any,
    transition: SpecTransition,
    *,
    audit_emitter: AuditEmitter = default_audit_emitter,
) -> store.SpecRecord:
    """AC-1: apply `transition` if it is a valid FSM edge, else raise
    `InvalidTransition` / `SpecNotFound`; emits a `spec_transition` audit
    event on success.
    """
    spec = store.get_spec(transition.tenant_id, transition.spec_id)
    if spec is None:
        raise SpecNotFound(transition.spec_id)

    allowed = VALID_TRANSITIONS.get(spec.status, set())
    if transition.requested_state not in allowed:
        raise InvalidTransition(spec.status, transition.requested_state)

    previous_status = spec.status
    updated = store.update_spec_status(
        transition.tenant_id, transition.spec_id, transition.requested_state
    )
    await audit_emitter.emit(
        conn,
        AuditEvent(
            tenant_id=transition.tenant_id,
            event_type="spec_transition",
            actor_iri=transition.actor_iri,
            subject_iri=spec_iri(transition.tenant_id, transition.spec_id),
            payload={"from": previous_status, "to": transition.requested_state},
            engine="build",
        ),
    )
    return updated
