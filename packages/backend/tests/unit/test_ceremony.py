"""AC-1..AC-4: the phase-gate ceremony's step orchestration and auto-trigger
guard (BE-TASK-008, build-engine EPIC-012). Approval-side unit tests live in
`test_ceremony_approval.py`.
"""

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.build.ceremony import CeremonyContext, on_phase_complete, run_phase_ceremony
from weave_backend.build.qa_suite import QAProject
from weave_backend.build.state_spine import StateSpine

_CTX = CeremonyContext(
    tenant_id="t1",
    actor_iri="urn:weave:principal:service:build-engine",
    project_iri="p1",
    run_id="r1",
)


def _spine(*, phase: str) -> StateSpine:
    return StateSpine(project_iri="p1", tenant_id="t1", run_id="r1", phase=phase, turn_cap=10)  # type: ignore[arg-type]


def _passing_run_command(_cmd: str) -> SimpleNamespace:
    return SimpleNamespace(status="PASS", evidence="", returncode=0)


@pytest.fixture(autouse=True)
def _record_gate_stub() -> Iterator[None]:
    with (
        patch("weave_backend.build.ceremony.record_gate", AsyncMock()),
        patch("weave_backend.build.qa_agent.run_command", side_effect=_passing_run_command),
    ):
        yield


async def test_should_block_approve_on_critical_security_finding() -> None:
    """AC-3: a CRITICAL security finding never halts the ceremony loop --
    it surfaces as `approve_blocked=True` on the clean-run result.
    """

    def _security_fail(cmd: str) -> SimpleNamespace:
        if "semgrep" in cmd:
            return SimpleNamespace(status="FAIL", evidence="sql injection", returncode=1)
        return SimpleNamespace(status="PASS", evidence="", returncode=0)

    with patch("weave_backend.build.qa_agent.run_command", side_effect=_security_fail):
        outcome = await run_phase_ceremony(
            None, _CTX, project=QAProject(), qa_run_fn=AsyncMock(return_value={"result": "PASS"})
        )

    assert outcome["ceremony"] == "awaiting_hitl"
    assert outcome["approve_blocked"] is True


async def test_should_keep_ceremony_gate_closed_when_a_ceremony_step_errors() -> None:
    """AC-4: any step exception (tool crash/timeout/unreachable service)
    halts the ceremony -- the gate never fires.
    """
    notify = AsyncMock()
    qa_run_fn = AsyncMock(side_effect=RuntimeError("qa suite crashed"))

    outcome = await run_phase_ceremony(
        None, _CTX, project=QAProject(), qa_run_fn=qa_run_fn, notify=notify
    )

    assert outcome["ceremony"] == "halted"
    assert outcome["reason"] == "qa_full"
    notify.assert_awaited_once()
    _, kwargs = notify.call_args
    assert kwargs["event_type"] == "ceremony_halted"


async def test_should_halt_ceremony_when_qa_full_returns_fail_verdict_not_exception() -> None:
    """AC-2/AC-4 edge case: `qa_full` can halt via its own `FAIL` result
    (data path), not just via a raised exception -- distinct from the
    exception-based halt test above and from `coverage_audit`'s halt. The
    loop must stop before `coverage_audit` runs at all.
    """
    qa_run_fn = AsyncMock(return_value={"result": "FAIL", "categories": []})

    outcome = await run_phase_ceremony(
        None, _CTX, project=QAProject(), qa_run_fn=qa_run_fn, notify=AsyncMock()
    )

    assert outcome["ceremony"] == "halted"
    assert outcome["reason"] == "qa_full"
    gate_names = [row["gate"] for row in outcome["gate_rows"]]
    assert "coverage_audit" not in gate_names


async def test_mutation_critical_finding_blocks_approve_not_halt() -> None:
    """Pseudocode: "< gate => RED (blocks approve like CRITICAL)" -- a
    failing mutation command must NOT halt the ceremony loop (unlike
    qa_full/coverage_audit); it surfaces as `approve_blocked=True`, same
    as the security-finding path.
    """

    def _mutation_fail(cmd: str) -> SimpleNamespace:
        if "mutmut" in cmd:
            return SimpleNamespace(status="FAIL", evidence="surviving mutants", returncode=1)
        return SimpleNamespace(status="PASS", evidence="", returncode=0)

    with patch("weave_backend.build.qa_agent.run_command", side_effect=_mutation_fail):
        outcome = await run_phase_ceremony(
            None, _CTX, project=QAProject(), qa_run_fn=AsyncMock(return_value={"result": "PASS"})
        )

    assert outcome["ceremony"] == "awaiting_hitl"
    assert outcome["approve_blocked"] is True


async def test_should_halt_ceremony_when_coverage_audit_fails() -> None:
    """`coverage_audit`'s literal "halt" verdict DOES stop the loop (unlike
    security/mutation) -- insufficient spec coverage is a broken-evidence
    failure, not a human-judgement finding.
    """
    project = QAProject(
        task_briefs=({"acceptance_criteria": [{"id": "AC-1"}], "ac_to_test_map": []},),
    )

    outcome = await run_phase_ceremony(
        None,
        _CTX,
        project=project,
        qa_run_fn=AsyncMock(return_value={"result": "PASS"}),
        notify=AsyncMock(),
    )

    assert outcome["ceremony"] == "halted"
    assert outcome["reason"] == "coverage_audit"


async def test_should_run_ceremony_steps_in_order_with_gate_rows() -> None:
    outcome = await run_phase_ceremony(
        None, _CTX, project=QAProject(), qa_run_fn=AsyncMock(return_value={"result": "PASS"})
    )

    assert outcome["ceremony"] == "awaiting_hitl"
    gate_names = [row["gate"] for row in outcome["gate_rows"]]
    assert gate_names == [
        "ceremony_security",
        "ceremony_mutation",
        "qa_full",
        "coverage_audit",
        "ceremony_summary",
    ]


async def test_on_phase_complete_is_a_noop_when_phase_not_complete() -> None:
    run_ceremony = AsyncMock()

    outcome = await on_phase_complete(
        None,
        _spine(phase="running"),
        tenant_id="t1",
        project=QAProject(),
        run_phase_ceremony_fn=run_ceremony,
    )

    assert outcome is None
    run_ceremony.assert_not_awaited()


async def test_on_phase_complete_triggers_ceremony_on_phase_complete() -> None:
    """AC-1: phase-complete auto-triggers the ceremony -- no manual
    invocation required.
    """
    run_ceremony = AsyncMock(return_value={"ceremony": "awaiting_hitl", "gate_rows": []})

    outcome = await on_phase_complete(
        None,
        _spine(phase="complete"),
        tenant_id="t1",
        project=QAProject(),
        run_phase_ceremony_fn=run_ceremony,
    )

    assert outcome == {"ceremony": "awaiting_hitl", "gate_rows": []}
    run_ceremony.assert_awaited_once()
