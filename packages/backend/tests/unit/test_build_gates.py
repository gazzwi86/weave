"""BE-TASK-007 (build-engine EPIC-012) unit tests: the DoR/DoD/pre-scaffold
gate logic, DB/audit collaborators patched out at the `gates` module
boundary -- same pattern as `test_briefs_router.py` (BE-TASK-002). The
real-Postgres/audit-persistence proof lives in
`tests/integration/test_gates_api.py`.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.build import store as task_store
from weave_backend.build.gates import run_dod_gate, run_dor_gate, run_pre_scaffold_gate
from weave_backend.build.qa_agent import CommandOutcome

_TENANT = "tenant-gates"
_ACTOR_IRI = "urn:weave:principal:user:u-1"
_TASK_ID = "task-1"
_PROJECT_IRI = "urn:weave:project:tenant-gates:acme"


@pytest.fixture(autouse=True)
def _reset_store() -> None:
    task_store.reset_for_tests()


def _valid_brief_content() -> dict[str, Any]:
    return {
        "acceptance_criteria": [
            {"id": "AC-1", "criterion": "WHEN X THE SYSTEM SHALL Y", "test_mapping": "test_x"}
        ],
        "ac_to_test_map": [{"ac_id": "AC-1", "test_name": "test_x"}],
        "dep_chain": {"blocked_by": [], "unlocks": []},
        "cost_estimate": {
            "complexity": "S",
            "estimated_tokens_input_k": 1,
            "estimated_tokens_output_k": 1,
            "estimated_cost_usd": 0.1,
        },
        "design_decisions": [{"decision": "Use X", "reference": "ADR-1"}],
    }


# --- DoR gate -------------------------------------------------------------


async def test_dor_gate_holds_task_when_brief_missing_ears_acs() -> None:
    content = _valid_brief_content()
    del content["acceptance_criteria"]

    with (
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_dor_gate(
            object(), tenant_id=_TENANT, actor_iri=_ACTOR_IRI, task_id=_TASK_ID, content=content
        )

    assert result == {
        "gate": "DoR",
        "result": "NOT_READY",
        "failing_checks": ["acceptance_criteria"],
    }
    held_task = task_store.get_task(_TENANT, _TASK_ID)
    assert held_task is not None
    assert held_task.status == "Ready"


async def test_dor_gate_not_ready_when_criterion_does_not_start_with_when() -> None:
    content = _valid_brief_content()
    content["acceptance_criteria"][0]["criterion"] = "The system does Y"

    with (
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_dor_gate(
            object(), tenant_id=_TENANT, actor_iri=_ACTOR_IRI, task_id=_TASK_ID, content=content
        )

    assert result["result"] == "NOT_READY"
    assert "acceptance_criteria" in result["failing_checks"]


async def test_dor_gate_not_ready_when_ac_to_test_map_count_differs() -> None:
    content = _valid_brief_content()
    content["ac_to_test_map"] = []

    with (
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_dor_gate(
            object(), tenant_id=_TENANT, actor_iri=_ACTOR_IRI, task_id=_TASK_ID, content=content
        )

    assert result["result"] == "NOT_READY"
    assert "ac_to_test_map" in result["failing_checks"]


async def test_dor_gate_not_ready_includes_failing_checks_list() -> None:
    content = _valid_brief_content()
    del content["cost_estimate"]
    del content["design_decisions"]

    with (
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_dor_gate(
            object(), tenant_id=_TENANT, actor_iri=_ACTOR_IRI, task_id=_TASK_ID, content=content
        )

    assert set(result["failing_checks"]) == {"cost_estimate", "design_decisions"}


async def test_dor_gate_pass_logged_to_audit() -> None:
    mock_emit = AsyncMock()
    with (
        patch("weave_backend.build.gates.default_audit_emitter.emit", mock_emit),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_dor_gate(
            object(),
            tenant_id=_TENANT,
            actor_iri=_ACTOR_IRI,
            task_id=_TASK_ID,
            content=_valid_brief_content(),
        )

    assert result == {"gate": "DoR", "result": "READY"}
    mock_emit.assert_awaited_once()
    assert mock_emit.await_args is not None
    emitted_event = mock_emit.await_args.args[1]
    assert emitted_event.event_type == "gate_result_dor"
    assert emitted_event.payload["result"] == "READY"


# --- DoD gate ---------------------------------------------------------------


async def test_dod_gate_marks_not_verified_for_unrunnable_command() -> None:
    def _fake_run_command(cmd: str) -> CommandOutcome:
        if "mutmut" in cmd:
            return CommandOutcome(status="NOT_VERIFIED", evidence="binary not found")
        return CommandOutcome(status="PASS")

    with (
        patch("weave_backend.build.gates.qa_agent.run_command", side_effect=_fake_run_command),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_dod_gate(
            object(), tenant_id=_TENANT, actor_iri=_ACTOR_IRI, task_id=_TASK_ID
        )

    assert result["result"] == "FAIL"
    mutation_result = next(c for c in result["commands"] if c["name"] == "mutation")
    assert mutation_result["status"] == "NOT_VERIFIED"


async def test_dod_gate_marks_overall_fail_on_nonzero_exit_code() -> None:
    def _fake_run_command(cmd: str) -> CommandOutcome:
        if "ruff" in cmd:
            return CommandOutcome(status="FAIL", evidence="lint error")
        return CommandOutcome(status="PASS")

    with (
        patch("weave_backend.build.gates.qa_agent.run_command", side_effect=_fake_run_command),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_dod_gate(
            object(), tenant_id=_TENANT, actor_iri=_ACTOR_IRI, task_id=_TASK_ID
        )

    assert result["result"] == "FAIL"


async def test_dod_gate_pass_logged_to_audit() -> None:
    mock_emit = AsyncMock()
    with (
        patch(
            "weave_backend.build.gates.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", mock_emit),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_dod_gate(
            object(), tenant_id=_TENANT, actor_iri=_ACTOR_IRI, task_id=_TASK_ID
        )

    assert result["result"] == "PASS"
    mock_emit.assert_awaited_once()
    assert mock_emit.await_args is not None
    emitted_event = mock_emit.await_args.args[1]
    assert emitted_event.event_type == "gate_result_dod"
    assert emitted_event.payload["result"] == "PASS"


# --- Pre-scaffold gate --------------------------------------------------


async def test_pre_scaffold_gate_blocks_scaffolding_on_critical_cascade_gap() -> None:
    """TASK-009/AC-7: `should block scaffolding on critical cascade gap` --
    replaces the M1 always-PROCEED stub. Missing PRD/roadmap/tech-spec/
    impl-ready are all critical (Implementation Hints); BLOCKED names the
    first failing step in cascade order.
    """
    task_store.upsert_project_spec(_TENANT, _PROJECT_IRI, brief_present=True)

    with (
        patch("weave_backend.build.gates.notify_tenant_admins", AsyncMock()),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_pre_scaffold_gate(
            object(), tenant_id=_TENANT, actor_iri=_ACTOR_IRI, project_iri=_PROJECT_IRI
        )

    assert result["result"] == "BLOCKED"
    assert result["failing_step"] == "prd"
    failing_steps = {finding["step"] for finding in result["findings"]}
    assert failing_steps == {"prd", "roadmap", "tech_spec", "impl_ready"}


async def test_pre_scaffold_critical_gap_fires_blocking_notify_and_records_blocked_row() -> None:
    """TASK-009/AC-8: `should fire blocking notify and record BLOCKED row`."""
    task_store.upsert_project_spec(
        _TENANT,
        _PROJECT_IRI,
        brief_present=True,
        prd_present=True,
        roadmap_present=True,
        tech_spec_present=False,
        impl_ready_flag=True,
    )
    mock_notify = AsyncMock()
    mock_insert = AsyncMock()

    with (
        patch("weave_backend.build.gates.notify_tenant_admins", mock_notify),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", mock_insert),
    ):
        result = await run_pre_scaffold_gate(
            object(), tenant_id=_TENANT, actor_iri=_ACTOR_IRI, project_iri=_PROJECT_IRI
        )

    assert result["result"] == "BLOCKED"
    assert result["failing_step"] == "tech_spec"
    mock_notify.assert_awaited_once()
    assert mock_notify.await_args is not None
    assert mock_notify.await_args.kwargs["event_type"] == "spec_gap_critical"
    assert mock_notify.await_args.kwargs["payload"]["failing_step"] == "tech_spec"
    assert mock_notify.await_args.kwargs["payload"]["blocking"] is True
    mock_insert.assert_awaited_once()
    assert mock_insert.await_args is not None
    inserted_row = mock_insert.await_args.args[1]
    assert inserted_row.result == "BLOCKED"


async def test_pre_scaffold_proceeds_with_recorded_findings_when_gaps_are_non_critical() -> None:
    """TASK-009/AC-7: `should proceed with recorded findings when gaps are
    non-critical` -- a full cascade plus a stale-pin finding still PROCEEDs,
    the finding is recorded for visibility, not dropped.
    """
    task_store.upsert_project_spec(
        _TENANT,
        _PROJECT_IRI,
        brief_present=True,
        prd_present=True,
        roadmap_present=True,
        tech_spec_present=True,
        impl_ready_flag=True,
    )
    mock_notify = AsyncMock()

    with (
        patch("weave_backend.build.gates.notify_tenant_admins", mock_notify),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_pre_scaffold_gate(
            object(),
            tenant_id=_TENANT,
            actor_iri=_ACTOR_IRI,
            project_iri=_PROJECT_IRI,
            staleness={"lag": 3, "stale": True},
        )

    assert result["result"] == "PROCEED"
    assert result["findings"] == [
        {
            "step": "staleness",
            "reason": "pinned graph version is 3 version(s) behind latest",
            "critical": False,
        }
    ]
    mock_notify.assert_not_awaited()
