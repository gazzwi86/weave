"""BE-TASK-006 AC-1/AC-2/AC-3 (build-engine EPIC-011): preflight
credential-reference check, run at run start and every phase boundary.
Existence-only (`describe_secret`, never `get_secret_value`) -- a preflight
check must never be able to leak a credential (AC-3, invariants.md greps
for `get_secret_value`'s absence from this module).

Reuses the generic `gate_results` write path (`record_gate`/`GateRecord`,
ADR-004) rather than a new table -- `run_id`/`phase` travel inside the
existing `payload` JSONB column.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import asyncpg

from weave_backend.build.gates import GateRecord, record_gate
from weave_backend.build.hitl import HitlGateContext, fire_hitl_gate
from weave_backend.build.state_spine import BUILD_PRINCIPAL_IRI
from weave_backend.repo_bootstrap.secrets import describe_secret


class RunHalted(Exception):
    """AC-2: a critical required credential reference is missing -- the
    run halts fail-closed rather than dispatching against an environment
    it can't actually operate in.
    """


@dataclass(frozen=True)
class RequiredRef:
    name: str
    critical: bool = True


@dataclass(frozen=True)
class PreflightRequest:
    """Law E 5-param budget: bundles `preflight()`'s call-site data so the
    function itself stays at (conn, request, deps).
    """

    tenant_id: str
    project_iri: str
    run_id: str
    phase: str
    refs: tuple[RequiredRef, ...]


@dataclass(frozen=True)
class PreflightDeps:
    """Law E 5-param budget grouping -- same precedent as `OrchestratorDeps`
    and `RepoBootstrapDeps`.
    """

    describe_secret_fn: Any = describe_secret
    record_gate_fn: Any = record_gate
    fire_hitl_gate_fn: Any = fire_hitl_gate


DEFAULT_PREFLIGHT_DEPS = PreflightDeps()


def required_refs(source_control_token_secret_ref: str | None) -> tuple[RequiredRef, ...]:
    """Implementation Hints: a data table, not branching logic. M1's only
    required ref is the project's SCM token (already captured on the
    project row at TASK-001 create time -- no new lookup). Per-project
    extras from `PLAT-SETTINGS-1` are a documented future extension point
    (ADR-018), not built here -- no such settings source exists yet.
    """
    if source_control_token_secret_ref is None:
        return ()
    return (RequiredRef(name=source_control_token_secret_ref, critical=True),)


async def preflight(
    conn: asyncpg.Connection,
    request: PreflightRequest,
    *,
    deps: PreflightDeps = DEFAULT_PREFLIGHT_DEPS,
) -> None:
    """AC-1/AC-2/AC-3: checks every ref's existence (never its value),
    records exactly one `gate_results` row regardless of outcome, and
    halts fail-closed to HITL if any *critical* ref is missing. A missing
    non-critical ref is recorded as a warning in the payload, not a halt.
    """
    results = [
        {"ref": ref.name, "ok": await deps.describe_secret_fn(ref.name), "critical": ref.critical}
        for ref in request.refs
    ]

    await deps.record_gate_fn(
        conn,
        GateRecord(
            tenant_id=request.tenant_id,
            actor_iri=BUILD_PRINCIPAL_IRI,
            event_type="gate_result_preflight",
            subject_iri=request.project_iri,
            gate="preflight",
            result="PASS" if all(r["ok"] for r in results) else "FAIL",
            payload={"refs": results, "phase": request.phase, "run_id": request.run_id},
            project_iri=request.project_iri,
        ),
    )

    missing_critical = [str(r["ref"]) for r in results if r["critical"] and not r["ok"]]
    if missing_critical:
        await deps.fire_hitl_gate_fn(
            conn,
            HitlGateContext(
                tenant_id=request.tenant_id,
                task_id=f"run:{request.run_id}",
                submitting_principal_iri=BUILD_PRINCIPAL_IRI,
                evidence=f"preflight_failed:{','.join(missing_critical)}",
            ),
        )
        raise RunHalted(f"missing critical refs: {missing_critical}")
