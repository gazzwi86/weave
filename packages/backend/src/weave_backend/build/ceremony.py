"""BE-TASK-008 (build-engine EPIC-012): the six-step phase-gate ceremony
that auto-triggers on `StateSpine.phase == "complete"` -- security review,
delta-mutation, TASK-007's full QA suite, the spec-coverage audit
(`spec_coverage.py`, FR-053), a doc-refresh/summary step, then HITL under
M1's fail-closed/no-self-approval invariants (FR-052).

Design Decisions (task brief + ADR-017):
- Steps are a data table (`STEPS`), not bespoke functions -- same
  precedent as `qa_suite.CATEGORIES`/`gates._DOD_COMMANDS`. Any step
  exception fails the whole ceremony closed (AC-4); no per-step error
  creativity -- the `except` in the loop is the invariant.
- Approve-blocked != ceremony-failed: `ceremony_security`/`ceremony_mutation`
  never halt the loop -- a CRITICAL finding sets `critical` in the step's
  evidence instead, enforced at approval time so Amend/Reject stay live
  (AC-3). `qa_full` (TASK-007's PASS/FAIL) and `coverage_audit` (literal
  "halt") DO halt the loop -- their failures are broken/insufficient
  evidence, not a finding needing human judgement.
- Reuses `gates.record_gate` (audit + `gate_results`, the same seam
  TASK-007's suite uses) for every step row and the final approval row --
  no new table; `gate_results.project_iri`+`run_id` already carry the
  evidence pointers the brief's "lean state spine" decision asks for.
- Acting principals (D9 no-self-approval) are read from `audit_entries`
  (`gate_results` has no actor column) -- a documented proxy, not a new
  join table.
- The ceremony is NOT wired into `orchestrator.run_dark_factory` (TASK-006,
  a concurrently-developed file this task does not touch) -- `on_phase_complete`
  is a standalone entry point a caller invokes once `spine.phase == "complete"`,
  same "caller assembles facts, module never reaches into the DB/FS itself"
  discipline as `qa_suite.QAProject`.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import asyncpg

from weave_backend.build import qa_agent
from weave_backend.build.gates import GateRecord, record_gate
from weave_backend.build.hitl import notify_tenant_admins
from weave_backend.build.qa_suite import QAProject, QARunContext, run_full_qa_suite
from weave_backend.build.spec_coverage import run_spec_coverage_audit
from weave_backend.build.state_spine import BUILD_PRINCIPAL_IRI, StateSpine


@dataclass(frozen=True)
class CeremonyContext:
    """Grouped ceremony-run identity (Law E 5-param budget)."""

    tenant_id: str
    actor_iri: str
    project_iri: str
    run_id: str


@dataclass(frozen=True)
class _StepArgs:
    """Grouped per-step invocation context -- every step function takes one
    of these (Law E 5-param budget), so the loop in `run_phase_ceremony`
    stays uniform regardless of what a given step actually needs.
    """

    conn: asyncpg.Connection
    ctx: CeremonyContext
    project: QAProject
    qa_run_fn: Any
    gate_rows: list[dict[str, Any]] = field(default_factory=list)


async def _security_step(args: _StepArgs) -> tuple[str, dict[str, Any]]:
    """Semgrep + Bandit over the phase diff -- never halts the loop itself
    (see module docstring); a tool failure sets `critical`.
    """
    findings: list[dict[str, Any]] = []
    critical = False
    for tool, cmd in (
        ("semgrep", "semgrep --config=auto --error ."),
        ("bandit", "bandit -r . -ll"),
    ):
        outcome = qa_agent.run_command(cmd)
        if outcome.status != "PASS":
            critical = True
            findings.append({"tool": tool, "status": outcome.status, "evidence": outcome.evidence})
    return "passed", {"critical": critical, "findings": findings}


async def _mutation_step(args: _StepArgs) -> tuple[str, dict[str, Any]]:
    """Delta-mutation gate -- pseudocode: "< gate => RED (blocks approve
    like CRITICAL)", never a ceremony halt.
    """
    outcome = qa_agent.run_command("mutmut run --use-coverage")
    return "passed", {"critical": outcome.status != "PASS", "evidence": outcome.evidence}


async def _qa_full_step(args: _StepArgs) -> tuple[str, dict[str, Any]]:
    result = await args.qa_run_fn(
        args.conn,
        run_ctx=QARunContext(
            tenant_id=args.ctx.tenant_id,
            actor_iri=args.ctx.actor_iri,
            project_iri=args.ctx.project_iri,
            run_id=args.ctx.run_id,
        ),
        project=args.project,
    )
    return ("passed" if result["result"] == "PASS" else "failed"), result


async def _coverage_step(args: _StepArgs) -> tuple[str, dict[str, Any]]:
    return run_spec_coverage_audit(args.project)


async def _summary_step(args: _StepArgs) -> tuple[str, dict[str, Any]]:
    """Doc-refresh + phase-summary step. No doc-refresh tooling exists in
    this codebase yet (out of this task's AC scope) -- this records the
    evidence-pointer bundle only (gate-row references), per the brief's
    "evidence pointers, not blobs, in state spine" decision.
    """
    return "passed", {"steps": list(args.gate_rows)}


StepFn = Callable[[_StepArgs], Awaitable[tuple[str, dict[str, Any]]]]

#: AC-1/AC-2: the ceremony's six steps (five gated + HITL) as a data table,
#: order matching the task brief's pseudocode.
STEPS: tuple[tuple[str, StepFn], ...] = (
    ("ceremony_security", _security_step),
    ("ceremony_mutation", _mutation_step),
    ("qa_full", _qa_full_step),
    ("coverage_audit", _coverage_step),
    ("ceremony_summary", _summary_step),
)


async def _record_step(
    conn: asyncpg.Connection,
    ctx: CeremonyContext,
    gate_kind: str,
    verdict: str,
    evidence: dict[str, Any],
) -> None:
    await record_gate(
        conn,
        GateRecord(
            tenant_id=ctx.tenant_id,
            actor_iri=ctx.actor_iri,
            event_type=f"gate_result_{gate_kind}",
            subject_iri=ctx.project_iri,
            gate=gate_kind,
            result=verdict,
            payload=evidence,
            project_iri=ctx.project_iri,
            run_id=ctx.run_id,
        ),
    )


async def _halt(
    conn: asyncpg.Connection,
    args: _StepArgs,
    gate_kind: str,
    reason_payload: dict[str, Any],
    notify: Any,
) -> dict[str, Any]:
    await notify(
        conn,
        tenant_id=args.ctx.tenant_id,
        event_type="ceremony_halted",
        payload={"run_id": args.ctx.run_id, "reason": gate_kind, **reason_payload},
        actor_iri=args.ctx.actor_iri,
    )
    return {"ceremony": "halted", "reason": gate_kind, "gate_rows": args.gate_rows}


async def run_phase_ceremony(
    conn: asyncpg.Connection,
    ctx: CeremonyContext,
    *,
    project: QAProject,
    qa_run_fn: Any = run_full_qa_suite,
    notify: Any = notify_tenant_admins,
) -> dict[str, Any]:
    """AC-1/AC-2/AC-3/AC-4: runs the five gated steps in order; any step
    exception or `failed`/`halt` verdict fails the whole ceremony closed
    (AC-4) and fires `PLAT-NOTIFY-1` `ceremony_halted` (Implementation
    Hints) so operators learn of a halt without polling. A clean run
    returns `approve_blocked` for the caller's HITL fire (AC-3).
    """
    args = _StepArgs(conn=conn, ctx=ctx, project=project, qa_run_fn=qa_run_fn)
    for gate_kind, step in STEPS:
        try:
            verdict, evidence = await step(args)
        except Exception as exc:  # AC-4: ANY step error fails closed
            payload = {"error": type(exc).__name__}
            await _record_step(conn, ctx, gate_kind, "failed", payload)
            return await _halt(conn, args, gate_kind, payload, notify)

        args.gate_rows.append({"gate": gate_kind, "verdict": verdict, "evidence": evidence})
        await _record_step(conn, ctx, gate_kind, verdict, evidence)
        if verdict in ("failed", "halt"):
            return await _halt(conn, args, gate_kind, {}, notify)

    approve_blocked = any(
        isinstance(row["evidence"], dict) and row["evidence"].get("critical")
        for row in args.gate_rows
    )
    return {
        "ceremony": "awaiting_hitl",
        "gate_rows": args.gate_rows,
        "approve_blocked": approve_blocked,
    }


async def on_phase_complete(
    conn: asyncpg.Connection,
    spine: StateSpine,
    *,
    tenant_id: str,
    project: QAProject,
    run_phase_ceremony_fn: Callable[..., Awaitable[dict[str, Any]]] = run_phase_ceremony,
) -> dict[str, Any] | None:
    """AC-1: fires the ceremony the instant `StateSpine.phase == "complete"`
    -- a no-op (`None`) for any other phase, so "no way to skip it" holds
    for every caller that reaches phase-complete and calls this
    unconditionally.
    """
    if spine.phase != "complete":
        return None
    return await run_phase_ceremony_fn(
        conn,
        CeremonyContext(
            tenant_id=tenant_id,
            actor_iri=BUILD_PRINCIPAL_IRI,
            project_iri=spine.project_iri,
            run_id=spine.run_id,
        ),
        project=project,
    )


#: Approval-side pieces (`resolve_acting_principals`, `CeremonyApprovalContext`,
#: `handle_ceremony_approval`, `ApproveBlockedByCriticalFinding`) live in
#: `ceremony_approval.py` -- split to stay under the 300-line file budget.
