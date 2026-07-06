"""BE-TASK-007 (build-engine EPIC-012): the three M1 quality gates -- DoR
(brief completeness before PLAN, FR-046), DoD (QA agent self-runs
commands, FR-047), and pre-scaffold (spec-review cascade stub, FR-055).

Each gate is a standalone module-level callable (Implementation Hints) --
the orchestrator (TASK-006) calls them at specific loop positions, and a
plain callable is easier to mock in unit tests than a class method.

Every gate result is persisted to `PLAT-AUDIT-1` (the audit chain) AND the
`gate_results` table (ADR-004) *before* the response returns -- an audit
record of a gate evaluation must exist even if the caller never reads the
response body.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import asyncpg

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.build import gate_store, qa_agent
from weave_backend.build.hitl import notify_tenant_admins
from weave_backend.build.store import (
    create_task,
    get_project_spec,
    get_task,
    task_iri,
    update_task_status,
)

_BUILD_ENGINE = "build"

#: AC-3/AC-4 (Implementation Hints): the QA agent runs each of these for
#: real -- no simulated result.
_DOD_COMMANDS: tuple[tuple[str, str], ...] = (
    ("lint", "ruff check . --exit-zero-on-no-files"),
    ("type_check", "mypy . --strict"),
    ("coverage", "pytest --cov --cov-fail-under=80"),
    ("mutation", "mutmut run --use-coverage"),
    ("sast", "bandit -r . -ll"),
)

#: AC-5/AC-6: cascade step name -> the `ProjectSpecRecord` attribute it reads.
_CASCADE_STEPS: tuple[tuple[str, str], ...] = (
    ("brief", "brief_present"),
    ("prd", "prd_present"),
    ("roadmap", "roadmap_present"),
    ("tech_spec", "tech_spec_present"),
    ("impl_ready", "impl_ready_flag"),
)


@dataclass(frozen=True)
class GateRecord:
    """Grouped input for `_record_gate` (Law E 5-parameter budget)."""

    tenant_id: str
    actor_iri: str
    event_type: str
    subject_iri: str
    gate: str
    result: str
    payload: dict[str, Any] = field(default_factory=dict)
    task_id: str | None = None
    project_iri: str | None = None


async def _record_gate(conn: asyncpg.Connection, record: GateRecord) -> None:
    """Audit chain first, then `gate_results` -- both land before the
    caller's HTTP response (Design Decisions).
    """
    await default_audit_emitter.emit(
        conn,
        AuditEvent(
            tenant_id=record.tenant_id,
            event_type=record.event_type,
            actor_iri=record.actor_iri,
            subject_iri=record.subject_iri,
            payload=record.payload,
            engine=_BUILD_ENGINE,
        ),
    )
    await gate_store.insert_gate_result(
        conn,
        gate_store.NewGateResult(
            tenant_id=record.tenant_id,
            gate=record.gate,
            result=record.result,
            payload=record.payload,
            task_id=record.task_id,
            project_iri=record.project_iri,
        ),
    )


def _acceptance_criteria_ok(content: dict[str, Any]) -> bool:
    acs = content.get("acceptance_criteria")
    if not acs:
        return False
    return all(
        isinstance(ac, dict) and str(ac.get("criterion", "")).startswith("WHEN ") for ac in acs
    )


def _ac_to_test_map_ok(content: dict[str, Any]) -> bool:
    acs = content.get("acceptance_criteria") or []
    if not acs:
        # Nothing to map -- the missing/empty acceptance_criteria failure is
        # already surfaced by `_acceptance_criteria_ok`; don't cascade it
        # onto this field too.
        return True
    mapping = content.get("ac_to_test_map")
    if not mapping:
        return False
    return len(mapping) == len(acs)


#: AC-1/AC-7: every field the DoR gate requires the stored brief to carry.
_REQUIRED_BRIEF_FIELDS: tuple[tuple[str, Any], ...] = (
    ("acceptance_criteria", _acceptance_criteria_ok),
    ("ac_to_test_map", _ac_to_test_map_ok),
    ("dep_chain", lambda c: c.get("dep_chain") is not None),
    ("cost_estimate", lambda c: c.get("cost_estimate") is not None),
    ("design_decisions", lambda c: bool(c.get("design_decisions"))),
)


async def run_dor_gate(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    actor_iri: str,
    task_id: str,
    content: dict[str, Any],
) -> dict[str, Any]:
    """AC-1/AC-2/AC-7. `content` is the stored brief's raw JSON dict
    (`StoredBrief.content`) -- checked as-is, not re-validated against the
    `TaskBrief` pydantic schema (the DoR gate is a completeness check on
    whatever was actually persisted).
    """
    failing = [name for name, check in _REQUIRED_BRIEF_FIELDS if not check(content)]
    result = "NOT_READY" if failing else "READY"
    payload: dict[str, Any] = {"result": result}

    if failing:
        payload["failing_checks"] = failing
        if get_task(tenant_id, task_id) is None:
            create_task(tenant_id, task_id, status="Ready")
        else:
            update_task_status(tenant_id, task_id, "Ready")

    await _record_gate(
        conn,
        GateRecord(
            tenant_id=tenant_id,
            actor_iri=actor_iri,
            event_type="gate_result_dor",
            subject_iri=task_iri(tenant_id, task_id),
            gate="dor",
            result=result,
            payload=payload,
            task_id=task_id,
        ),
    )

    if failing:
        return {"gate": "DoR", "result": "NOT_READY", "failing_checks": failing}
    return {"gate": "DoR", "result": "READY"}


async def run_dod_gate(
    conn: asyncpg.Connection, *, tenant_id: str, actor_iri: str, task_id: str
) -> dict[str, Any]:
    """AC-3/AC-4: shells out for real (no simulation). A command that
    cannot run (`NOT_VERIFIED`) fails the overall gate -- never skipped.
    """
    results: list[dict[str, str]] = []
    overall = "PASS"
    for name, cmd in _DOD_COMMANDS:
        outcome = qa_agent.run_command(cmd)
        results.append({"name": name, "status": outcome.status, "evidence": outcome.evidence})
        if outcome.status != "PASS":
            overall = "FAIL"

    await _record_gate(
        conn,
        GateRecord(
            tenant_id=tenant_id,
            actor_iri=actor_iri,
            event_type="gate_result_dod",
            subject_iri=task_iri(tenant_id, task_id),
            gate="dod",
            result=overall,
            payload={"result": overall, "commands": results},
            task_id=task_id,
        ),
    )
    return {
        "gate": "DoD",
        "result": overall,
        "commands": [{"name": r["name"], "status": r["status"]} for r in results],
    }


async def run_pre_scaffold_gate(
    conn: asyncpg.Connection, *, tenant_id: str, actor_iri: str, project_iri: str
) -> dict[str, Any]:
    """AC-5/AC-6: M1 pass-through stub -- records every failing cascade
    step and fires a `spec_gap_critical` warning per gap, but always
    PROCEEDs (M2 activates cascade-blocking, FR-055).
    """
    spec = get_project_spec(tenant_id, project_iri)
    findings: list[dict[str, str]] = []
    for step, attr in _CASCADE_STEPS:
        if getattr(spec, attr):
            continue
        reason = f"{step} not present or not ready"
        findings.append({"step": step, "reason": reason})
        await notify_tenant_admins(
            conn,
            tenant_id=tenant_id,
            event_type="spec_gap_critical",
            payload={"project_iri": project_iri, "failing_step": step},
            actor_iri=actor_iri,
        )

    await _record_gate(
        conn,
        GateRecord(
            tenant_id=tenant_id,
            actor_iri=actor_iri,
            event_type="gate_result_pre_scaffold",
            subject_iri=project_iri,
            gate="pre_scaffold",
            result="PROCEED",
            payload={"result": "PROCEED", "findings": findings},
            project_iri=project_iri,
        ),
    )
    return {"gate": "pre_scaffold", "result": "PROCEED", "findings": findings}
