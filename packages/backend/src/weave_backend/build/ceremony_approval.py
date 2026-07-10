"""BE-TASK-008 (build-engine EPIC-012): the ceremony's HITL approval side --
split out of `ceremony.py` to stay under the 300-line file budget (Law E).

AC-6/AC-7/AC-8: reuses M1's fail-closed/no-self-approval invariants
verbatim (Design Decisions: "Reuse M1 HITL + audit fail-closed machinery" --
no new approval flow). `ApproveBlockedByCriticalFinding` (AC-3) is separate
from both -- a blocked Approve is not a ceremony failure; Amend/Reject stay
live.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import asyncpg

from weave_backend.build.gates import GateRecord, record_gate
from weave_backend.build.hitl import (
    HitlGateClosedError,
    SelfApprovalNotPermitted,
    default_audit_health_check,
)

_ACTION_OUTCOMES = {"approve": "resumed", "reject": "halted", "amend": "replan"}


class ApproveBlockedByCriticalFinding(Exception):
    """AC-3: Approve is blocked while a CRITICAL finding stands -- Amend and
    Reject remain available; this is not a ceremony failure.
    """

    def __init__(self, run_id: str) -> None:
        super().__init__(run_id)
        self.run_id = run_id


async def resolve_acting_principals(
    conn: asyncpg.Connection, *, tenant_id: str, target_iris: frozenset[str]
) -> frozenset[str]:
    """D9 no-self-approval, phase-scoped (Implementation Hints: "acting
    principals = every principal that produced a commit or gate row within
    the phase -- not just the last agent"). `gate_results` has no actor
    column -- `audit_entries.actor_principal_iri` is the proxy every
    `record_gate` call already writes (ADR-017).
    """
    if not target_iris:
        return frozenset()
    rows = await conn.fetch(
        "SELECT DISTINCT actor_principal_iri FROM audit_entries"
        " WHERE tenant_id = $1 AND target_iri = ANY($2::text[])"
        " AND event_type LIKE 'gate_result_%'",
        tenant_id,
        list(target_iris),
    )
    return frozenset(row["actor_principal_iri"] for row in rows)


@dataclass(frozen=True)
class CeremonyApprovalContext:
    """Grouped approval-time input (Law E 5-param budget)."""

    tenant_id: str
    project_iri: str
    run_id: str
    approving_principal_iri: str
    action: str
    approve_blocked: bool = False
    gate_rows: list[dict[str, Any]] = field(default_factory=list)


async def handle_ceremony_approval(
    conn: asyncpg.Connection,
    ctx: CeremonyApprovalContext,
    *,
    acting_principals: frozenset[str],
    health_check: Any = default_audit_health_check,
) -> dict[str, str]:
    """AC-6/AC-7/AC-8: reuses M1's fail-closed/no-self-approval invariants
    verbatim (Design Decisions) -- audit-outage and self-approval both
    raise before any state change; a blocked Approve raises
    `ApproveBlockedByCriticalFinding` (Amend/Reject still reach
    `record_gate` below, per AC-3). A clean approve/reject/amend emits
    `PLAT-AUDIT-1` `ceremony_approved` with the approver principal (AC-8).
    """
    healthy = await health_check()
    if not healthy:
        raise HitlGateClosedError("audit service unreachable; ceremony gate stays closed")
    if ctx.approving_principal_iri in acting_principals:
        raise SelfApprovalNotPermitted(ctx.approving_principal_iri)
    if ctx.action == "approve" and ctx.approve_blocked:
        raise ApproveBlockedByCriticalFinding(ctx.run_id)

    await record_gate(
        conn,
        GateRecord(
            tenant_id=ctx.tenant_id,
            actor_iri=ctx.approving_principal_iri,
            event_type="ceremony_approved",
            subject_iri=ctx.project_iri,
            gate="ceremony_approved",
            result=ctx.action,
            payload={"gate_rows": ctx.gate_rows, "approver": ctx.approving_principal_iri},
            project_iri=ctx.project_iri,
            run_id=ctx.run_id,
        ),
    )
    return {"ceremony": _ACTION_OUTCOMES[ctx.action]}
