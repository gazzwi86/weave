"""BE-TASK-008 (build-engine EPIC-008): `generate_app` -- CE-READ-1-grounded
app generation + the 5 M1 safety gates (AC-1..AC-8), run atomically before
any commit (task brief's pseudocode). Mirrors `repo_bootstrap/service.py`'s
`RepoBootstrapDeps` injectable-collaborators pattern.
"""

from __future__ import annotations

import logging
import shutil
import tempfile
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import asyncpg
import httpx

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.briefs.ce_read_client import get_bpmo_context
from weave_backend.briefs.store import get_task_brief
from weave_backend.generation.engineer_agent import build_generation_prompt, generate_workspace
from weave_backend.generation.gates import GATE_PIPELINE, GateFailure, GateResult
from weave_backend.generation.store import NewGenerationRun, insert_generation_run
from weave_backend.pm.bindings import get_all as get_bindings
from weave_backend.projects.model import get_project
from weave_backend.repo_bootstrap.drivers import RepoHandle, ScmDriver, get_scm_driver
from weave_backend.repo_bootstrap.secrets import get_scm_token
from weave_backend.repo_bootstrap.store import ProjectRepoRow, fetch_project_repo_row
from weave_backend.standards.effective import effective_set
from weave_backend.standards.generation_hook import (
    GenerationContextAddendum,
    build_context_addendum,
)
from weave_backend.standards.store import load_effective_standards

log = logging.getLogger(__name__)

#: Same service-actor convention as `repo_bootstrap.service`'s audit events.
BUILD_SERVICE_PRINCIPAL_IRI = "urn:weave:principal:service:build-engine"

__all__ = [
    "BUILD_SERVICE_PRINCIPAL_IRI",
    "DEFAULT_DEPS",
    "BriefNotFoundError",
    "GenerationContext",
    "GenerationDeps",
    "ProjectNotFoundError",
    "RepoNotBootstrappedError",
    "generate_app",
]


class ProjectNotFoundError(Exception):
    """404 `not_found` (pseudocode: "get_project -> 404 not_found")."""


class BriefNotFoundError(Exception):
    """404 `brief_not_found` (pseudocode: "get_brief -> 404 brief_not_found")."""


class RepoNotBootstrappedError(Exception):
    """Raised when a project's repo (TASK-010) or its SCM token isn't ready
    yet. Not part of the brief's documented error table (401/404/422/503
    only) -- deliberately left uncaught by the router so it surfaces as an
    unhandled 500 rather than inventing an undocumented error code; flagged
    as a brief gap in the task's progress summary.
    """


@dataclass(frozen=True)
class GenerationContext:
    """Groups the per-call identifiers (Law E budget) -- mirrors
    `AgentResultContext`/`HitlResponseContext` in `build/typed_result.py` /
    `build/hitl.py`.
    """

    tenant_id: str
    project_iri: str
    task_id: str
    ce_client: httpx.AsyncClient


@dataclass(frozen=True)
class GenerationDeps:
    """Groups the injectable side-effecting collaborators (Law E budget),
    mirroring `RepoBootstrapDeps`. `generate_workspace_fn` is the
    Engineer-agent DELEGATE seam -- Law F: tests inject their own
    fixture-seeding function instead of a real agent call.
    """

    generate_workspace_fn: Callable[..., Awaitable[None]]
    driver_for: Callable[[str], ScmDriver]
    get_secret: Callable[[str], Awaitable[str | None]]
    emit_audit: Callable[[asyncpg.Connection, AuditEvent], Awaitable[None]]


async def _default_emit_audit(conn: asyncpg.Connection, event: AuditEvent) -> None:
    await default_audit_emitter.emit(conn, event)


DEFAULT_DEPS = GenerationDeps(
    generate_workspace_fn=generate_workspace,
    driver_for=get_scm_driver,
    get_secret=get_scm_token,
    emit_audit=_default_emit_audit,
)


def _gate_result_dict(result: GateResult) -> dict[str, object]:
    body: dict[str, object] = {"gate": result.gate, "status": result.status}
    if result.score is not None:
        body["score"] = result.score
    return body


def _require_bootstrapped_repo(row: ProjectRepoRow | None) -> ProjectRepoRow:
    if row is None or not row.repo_provider or not row.repo_url or not row.repo_id:
        raise RepoNotBootstrappedError
    return row


async def _resolve_token(row: ProjectRepoRow, deps: GenerationDeps) -> str:
    token = await deps.get_secret(row.source_control_token_secret_ref or "")
    if not token:
        raise RepoNotBootstrappedError
    return token


@dataclass(frozen=True)
class _CommitTarget:
    entity: str
    task_id: str
    brief_title: str
    repo: RepoHandle
    token: str


async def _commit_workspace(
    workspace: str, target: _CommitTarget, driver: ScmDriver
) -> tuple[str, str]:
    branch = f"build/{target.entity}/{target.task_id}"
    message = f"feat({target.entity}): generate {target.brief_title}"
    commit_sha = await driver.commit_workspace(
        target.repo, workspace=workspace, branch=branch, message=message, token=target.token
    )
    return commit_sha, branch


async def _emit_secret_scan_fail(
    conn: asyncpg.Connection, ctx: GenerationContext, deps: GenerationDeps, exc: GateFailure
) -> None:
    await deps.emit_audit(
        conn,
        AuditEvent(
            tenant_id=ctx.tenant_id,
            event_type="secret_scan_fail",
            actor_iri=BUILD_SERVICE_PRINCIPAL_IRI,
            subject_iri=ctx.project_iri,
            payload={"task_id": ctx.task_id, **exc.evidence},
            engine="build",
        ),
    )


async def _load_standards_addendum(
    conn: asyncpg.Connection, ctx: GenerationContext
) -> GenerationContextAddendum:
    """TASK-001 AC-4/AC-5: folds the effective standards set into the
    generation context. An empty catalogue degrades to the M1 demo-default
    stack with a `standards_missing` run-log warning -- it never halts
    generation. A `stack_pins` conflict across keys falls back to the
    demo-default for that one axis (never last-key-wins) and is logged as
    a finding; run-log here is Python `logging`, same convention as
    `projects/ce_version_client.py`'s `log.warning(...)` (no dedicated
    run-log object exists in this codebase).
    """
    company, project = await load_effective_standards(
        conn, tenant_id=ctx.tenant_id, project_id=ctx.project_iri
    )
    addendum = build_context_addendum(effective_set(company, project))
    if addendum.standards_missing:
        log.warning(
            "standards_missing: project=%s -- falling back to M1 demo-default stack",
            ctx.project_iri,
        )
    for conflict in addendum.conflicts:
        log.warning(
            "standards_conflict: project=%s axis=%s values=%s -- falling back to"
            " demo-default for this axis",
            ctx.project_iri,
            conflict.axis,
            conflict.values,
        )
    return addendum


async def _load_external_bindings(
    conn: asyncpg.Connection, ctx: GenerationContext
) -> list[dict[str, str]]:
    """AC-6: refs only (system/space_ref/connector_ref) -- never
    credentials, delivery stays Platform-owned. No bindings is a normal
    state (empty list), not an error.
    """
    bindings = await get_bindings(conn, tenant_id=ctx.tenant_id, project_iri=ctx.project_iri)
    return [
        {"system": b.system, "space_ref": b.space_ref, "connector_ref": b.connector_ref}
        for b in bindings
    ]


async def generate_app(
    conn: asyncpg.Connection, ctx: GenerationContext, deps: GenerationDeps = DEFAULT_DEPS
) -> dict[str, object]:
    """AC-1..AC-8: generate an app grounded in CE-READ-1, run the 5 M1
    safety gates atomically, commit only on an all-pass result.
    """
    project = await get_project(conn, tenant_id=ctx.tenant_id, project_iri=ctx.project_iri)
    if project is None:
        raise ProjectNotFoundError(ctx.project_iri)

    brief = await get_task_brief(conn, tenant_id=ctx.tenant_id, task_id=ctx.task_id)
    if brief is None:
        raise BriefNotFoundError(ctx.task_id)

    # AC-1: non-degradable -- CeReadUnavailable propagates to the router's
    # 503 mapping, generation never proceeds without graph context.
    bpmo = await get_bpmo_context(ctx.ce_client, ctx.project_iri)
    addendum = await _load_standards_addendum(conn, ctx)
    external_bindings = await _load_external_bindings(conn, ctx)
    bpmo = {
        **bpmo,
        "standards_section": addendum.standards_section,
        "stack_pins": addendum.stack_pins,
        "external_bindings": external_bindings,
    }

    repo_row = _require_bootstrapped_repo(
        await fetch_project_repo_row(conn, tenant_id=ctx.tenant_id, project_iri=ctx.project_iri)
    )
    token = await _resolve_token(repo_row, deps)

    workspace = tempfile.mkdtemp(prefix=f"build-{ctx.task_id}-")
    try:
        prompt = build_generation_prompt(brief.content, bpmo)
        await deps.generate_workspace_fn(prompt=prompt, output_dir=workspace, bpmo=bpmo)

        gate_results = [gate(workspace) for gate in GATE_PIPELINE]  # AC-3: fixed order, atomic

        target = _CommitTarget(
            entity=ctx.project_iri.split(":")[-1],
            task_id=ctx.task_id,
            brief_title=str(brief.content.get("title", ctx.task_id)),
            repo=RepoHandle(
                repo_id=repo_row.repo_id or "",
                url=repo_row.repo_url or "",
                default_branch=repo_row.repo_default_branch or "main",
            ),
            token=token,
        )
        driver = deps.driver_for(repo_row.repo_provider or "")
        commit_sha, branch = await _commit_workspace(workspace, target, driver)
    except GateFailure as exc:
        # AC-4: only the secret-scan gate emits an audit event on failure.
        if exc.error == "secret_scan_fail":
            await _emit_secret_scan_fail(conn, ctx, deps, exc)
        raise
    finally:
        shutil.rmtree(workspace, ignore_errors=True)

    gate_dicts = [_gate_result_dict(result) for result in gate_results]
    await insert_generation_run(
        conn,
        tenant_id=ctx.tenant_id,
        run=NewGenerationRun(
            project_iri=ctx.project_iri,
            task_id=ctx.task_id,
            gate_results=gate_dicts,
            branch=branch,
            commit_sha=commit_sha,
        ),
    )
    await deps.emit_audit(
        conn,
        AuditEvent(
            tenant_id=ctx.tenant_id,
            event_type="generation_complete",
            actor_iri=BUILD_SERVICE_PRINCIPAL_IRI,
            subject_iri=ctx.project_iri,
            payload={"task_id": ctx.task_id, "commit_sha": commit_sha, "branch": branch},
            engine="build",
        ),
    )
    return {"commit_sha": commit_sha, "branch": branch, "gates_passed": gate_dicts}
