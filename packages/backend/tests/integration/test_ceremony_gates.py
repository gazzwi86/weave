"""BE-TASK-008 (build-engine EPIC-012) integration tests: the phase-gate
ceremony against a real docker-marked stack (Postgres + RLS +
`PLAT-AUDIT-1`) -- same lane conventions as `test_qa_suite_gates.py`
(BE-TASK-007). No public endpoint (task brief: ceremony is invoked by the
orchestrator/caller, not a router) -- call `ceremony.py` directly through a
real tenant connection.

ponytail: written but NOT run by this lane (docker tests are serialised by
the coordinator across parallel lanes) -- run with
`pytest -m "integration and docker and not stack"` once the coordinator
schedules this lane's docker pass.
"""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.build.ceremony import CeremonyContext, on_phase_complete, run_phase_ceremony
from weave_backend.build.ceremony_approval import (
    CeremonyApprovalContext,
    handle_ceremony_approval,
    resolve_acting_principals,
)
from weave_backend.build.hitl import HitlGateClosedError, SelfApprovalNotPermitted
from weave_backend.build.qa_agent import CommandOutcome
from weave_backend.build.qa_suite import QAProject
from weave_backend.build.state_spine import BUILD_PRINCIPAL_IRI, StateSpine
from weave_backend.db.pool import tenant_connection

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _project() -> QAProject:
    return QAProject(
        task_briefs=({"acceptance_criteria": [], "ac_to_test_map": []},),
    )


async def test_should_auto_trigger_ceremony_on_phase_complete(platform_stack: Path) -> None:
    """AC-1: an FSM event fixture reaching `phase == "complete"` runs the
    ceremony with no manual invocation.
    """
    tenant_id = f"tenant-ceremony-{uuid.uuid4().hex[:8]}"
    spine = StateSpine(
        project_iri=f"urn:weave:project:{tenant_id}:acme",
        tenant_id=tenant_id,
        run_id="run-1",
        phase="complete",
        turn_cap=10,
    )

    with patch(
        "weave_backend.build.ceremony.qa_agent.run_command",
        return_value=CommandOutcome(status="PASS"),
    ):
        async with tenant_connection(tenant_id) as conn:
            outcome = await on_phase_complete(
                conn, spine, tenant_id=tenant_id, project=_project()
            )

    assert outcome is not None
    assert outcome["ceremony"] == "awaiting_hitl"


async def test_should_run_ceremony_steps_in_order_with_gate_rows(platform_stack: Path) -> None:
    """AC-2: stub steps -- assert step order + persisted gate rows."""
    tenant_id = f"tenant-ceremony-{uuid.uuid4().hex[:8]}"
    project_iri = f"urn:weave:project:{tenant_id}:acme"
    ctx = CeremonyContext(
        tenant_id=tenant_id, actor_iri=BUILD_PRINCIPAL_IRI, project_iri=project_iri, run_id="run-1"
    )

    with patch(
        "weave_backend.build.ceremony.qa_agent.run_command",
        return_value=CommandOutcome(status="PASS"),
    ):
        async with tenant_connection(tenant_id) as conn:
            await run_phase_ceremony(
                conn, ctx, project=_project(), qa_run_fn=AsyncMock(return_value={"result": "PASS"})
            )
            rows = await conn.fetch(
                "SELECT gate FROM gate_results WHERE tenant_id = $1 AND run_id = $2 ORDER BY id",
                tenant_id,
                "run-1",
            )

    assert [r["gate"] for r in rows] == [
        "ceremony_security",
        "ceremony_mutation",
        "qa_full",
        "coverage_audit",
        "ceremony_summary",
    ]


async def test_should_reject_self_approval_of_ceremony(platform_stack: Path) -> None:
    """AC-6: the ceremony's own actor (`BUILD_PRINCIPAL_IRI`) produced every
    step's gate row -- it is an acting principal, so it cannot approve.
    """
    tenant_id = f"tenant-ceremony-{uuid.uuid4().hex[:8]}"
    project_iri = f"urn:weave:project:{tenant_id}:acme"
    ctx = CeremonyContext(
        tenant_id=tenant_id, actor_iri=BUILD_PRINCIPAL_IRI, project_iri=project_iri, run_id="run-1"
    )

    with patch(
        "weave_backend.build.ceremony.qa_agent.run_command",
        return_value=CommandOutcome(status="PASS"),
    ):
        async with tenant_connection(tenant_id) as conn:
            await run_phase_ceremony(
                conn, ctx, project=_project(), qa_run_fn=AsyncMock(return_value={"result": "PASS"})
            )
            acting = await resolve_acting_principals(
                conn, tenant_id=tenant_id, target_iris=frozenset({project_iri})
            )

            with pytest.raises(SelfApprovalNotPermitted):
                await handle_ceremony_approval(
                    conn,
                    CeremonyApprovalContext(
                        tenant_id=tenant_id,
                        project_iri=project_iri,
                        run_id="run-1",
                        approving_principal_iri=BUILD_PRINCIPAL_IRI,
                        action="approve",
                    ),
                    acting_principals=acting,
                )


async def test_should_keep_gate_closed_on_audit_outage(platform_stack: Path) -> None:
    """AC-7: the audit service unreachable at HITL time keeps the gate
    closed (M1 fail-closed invariant applies verbatim).
    """
    tenant_id = f"tenant-ceremony-{uuid.uuid4().hex[:8]}"
    project_iri = f"urn:weave:project:{tenant_id}:acme"

    async with tenant_connection(tenant_id) as conn:
        with pytest.raises(HitlGateClosedError):
            await handle_ceremony_approval(
                conn,
                CeremonyApprovalContext(
                    tenant_id=tenant_id,
                    project_iri=project_iri,
                    run_id="run-1",
                    approving_principal_iri="urn:weave:principal:user:u-2",
                    action="approve",
                ),
                acting_principals=frozenset(),
                health_check=AsyncMock(return_value=False),
            )


async def test_should_persist_phase_summary_and_audit_approval(platform_stack: Path) -> None:
    """AC-8: happy path end-to-end with stubs -- ceremony runs, a second
    principal approves, `ceremony_approved` lands in `gate_results` +
    `PLAT-AUDIT-1` with the approver principal.
    """
    tenant_id = f"tenant-ceremony-{uuid.uuid4().hex[:8]}"
    project_iri = f"urn:weave:project:{tenant_id}:acme"
    ctx = CeremonyContext(
        tenant_id=tenant_id, actor_iri=BUILD_PRINCIPAL_IRI, project_iri=project_iri, run_id="run-1"
    )
    approver = "urn:weave:principal:user:u-2"

    with patch(
        "weave_backend.build.ceremony.qa_agent.run_command",
        return_value=CommandOutcome(status="PASS"),
    ):
        async with tenant_connection(tenant_id) as conn:
            ceremony_outcome = await run_phase_ceremony(
                conn, ctx, project=_project(), qa_run_fn=AsyncMock(return_value={"result": "PASS"})
            )
            outcome = await handle_ceremony_approval(
                conn,
                CeremonyApprovalContext(
                    tenant_id=tenant_id,
                    project_iri=project_iri,
                    run_id="run-1",
                    approving_principal_iri=approver,
                    action="approve",
                    approve_blocked=ceremony_outcome["approve_blocked"],
                    gate_rows=ceremony_outcome["gate_rows"],
                ),
                acting_principals=frozenset({BUILD_PRINCIPAL_IRI}),
            )
            row = await conn.fetchrow(
                "SELECT result FROM gate_results"
                " WHERE tenant_id = $1 AND run_id = $2 AND gate = 'ceremony_approved'",
                tenant_id,
                "run-1",
            )
            audit_row = await conn.fetchrow(
                "SELECT actor_principal_iri FROM audit_entries"
                " WHERE tenant_id = $1 AND event_type = 'ceremony_approved'",
                tenant_id,
            )

    assert outcome == {"ceremony": "resumed"}
    assert row is not None
    assert row["result"] == "approve"
    assert audit_row is not None
    assert audit_row["actor_principal_iri"] == approver
