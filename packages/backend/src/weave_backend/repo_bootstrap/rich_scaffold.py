"""BE-TASK-006 AC-6/AC-7/AC-8 (build-engine EPIC-011): the M2 rich scaffold
that extends the M1 create+push floor (`ensure_project_repo`, run step 0)
with branch protection and additional harness files, then fires the
mandatory environment-verification HITL gate and holds feature-task
dispatch (`feature_dispatch_held`, migration 0030) until a human
(non-self, D9) approves it via `approve_env_verification`. Any scaffold
step failing halts fail-closed naming the step (AC-8) -- the M1 floor is
never rolled back or silently substituted for a failed rich-scaffold step.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Protocol

import asyncpg

from weave_backend.audit.emitter import AuditEvent
from weave_backend.build.hitl import HitlGateContext, SelfApprovalNotPermitted, fire_hitl_gate
from weave_backend.build.state_spine import BUILD_PRINCIPAL_IRI
from weave_backend.identity.registry import get_principal
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.harness_template import render_rich_scaffold_files
from weave_backend.repo_bootstrap.service import RepoBootstrapDeps, ensure_project_repo
from weave_backend.repo_bootstrap.store import (
    ProjectRepoRow,
    fetch_project_repo_row,
    set_feature_dispatch_held,
)
from weave_backend.standards.effective import effective_set
from weave_backend.standards.generation_hook import render_standards_section
from weave_backend.standards.store import load_effective_standards

_ENV_VERIFICATION_EVIDENCE = "rich_scaffold_complete"


class _HasPrincipalType(Protocol):
    """AC-7: `approve_env_verification` only reads `.type` off whatever
    `resolve_principal` returns -- a minimal structural Protocol (rather
    than the concrete `PrincipalRecord` dataclass) so tests can inject a
    bare `type`-only stand-in instead of building a full record. Declared
    as a read-only `@property` (not a plain attribute) so it structurally
    matches `PrincipalRecord`'s frozen-dataclass field, which mypy treats
    as read-only."""

    @property
    def type(self) -> str: ...


class ScaffoldFailed(Exception):
    """AC-8: a rich-scaffold step failed -- halt fail-closed naming the
    step. Raised only after the M1 floor (`ensure_project_repo`) already
    succeeded; that floor is never rolled back or silently substituted.
    """

    def __init__(self, step: str, cause: Exception) -> None:
        super().__init__(f"{step}: {cause}")
        self.step = step
        self.cause = cause


async def _resolve_token(row: ProjectRepoRow, deps: RepoBootstrapDeps) -> str:
    if row.source_control_token_secret_ref:
        token = await deps.get_secret(row.source_control_token_secret_ref)
        if token:
            return token
    raise ScaffoldFailed("token_resolution", RuntimeError("no resolvable SCM token"))


async def _standards_note(conn: asyncpg.Connection, *, tenant_id: str, project_iri: str) -> str:
    """Implementation hint: "render from the effective standards set when
    present (TASK-001) else the demo-default templates -- one call,
    already-built resolution." Reuses TASK-001's own resolver/merge/render
    chain verbatim; no new standards logic here.
    """
    company, project = await load_effective_standards(
        conn, tenant_id=tenant_id, project_id=project_iri
    )
    docs = effective_set(company, project)
    if not docs:
        return "No effective standards configured for this project -- demo-default harness only."
    return render_standards_section(docs)


def _scaffold_steps(
    *, driver: object, repo: RepoHandle, token: str, files: dict[str, str]
) -> tuple[tuple[str, Callable[[], Awaitable[object]]], ...]:
    """The pseudocode's `[branch_protection, ci_workflow, secrets_wiring,
    health_route_and_smoke, git_hooks, harness_boilerplate]` step list --
    the five file-producing steps land in one `harness_files` commit
    (ponytail: fewer provider round-trips than five separate commits of
    the same area; upgrade to per-file-group commits if a real project
    ever needs to review/reject one scaffold step independently of the
    others). Each entry is a zero-arg thunk, not an already-created
    coroutine, so a step never left un-awaited when an earlier one raises.
    """
    return (
        ("branch_protection", lambda: driver.apply_branch_protection(repo, token=token)),  # type: ignore[attr-defined]
        (
            "harness_files",
            lambda: driver.commit_files(  # type: ignore[attr-defined]
                repo,
                files=files,
                message="chore: rich scaffold (branch policy, CI, secrets, health+smoke, hooks)",
                token=token,
            ),
        ),
    )


async def rich_scaffold(
    conn: asyncpg.Connection, *, project_iri: str, tenant_id: str, deps: RepoBootstrapDeps
) -> None:
    """AC-6/AC-7/AC-8: idempotent per project -- runs the extra steps only
    once (`feature_dispatch_held` still `NULL`, i.e. never scaffolded).
    Applies branch protection + rich boilerplate onto the M1 floor, marks
    dispatch held, then fires the env-verification gate.
    """
    await ensure_project_repo(conn, project_iri=project_iri, tenant_id=tenant_id, deps=deps)
    row = await fetch_project_repo_row(conn, tenant_id=tenant_id, project_iri=project_iri)
    if row is None or row.feature_dispatch_held is not None:
        return  # already scaffolded (held or released) -- step 0 runs this once

    token = await _resolve_token(row, deps)
    repo = RepoHandle(
        repo_id=row.repo_id or "",
        url=row.repo_url or "",
        default_branch=row.repo_default_branch or "",
    )
    driver = deps.driver_for(row.repo_provider or "")
    note = await _standards_note(conn, tenant_id=tenant_id, project_iri=project_iri)
    files = render_rich_scaffold_files(
        project_name=row.name, provider=row.repo_provider or "github", standards_note=note
    )

    for step_name, run_step in _scaffold_steps(driver=driver, repo=repo, token=token, files=files):
        try:
            await run_step()
        except Exception as exc:  # AC-8: any scaffold step failure halts fail-closed
            raise ScaffoldFailed(step_name, exc) from exc

    # AC-7: held True *before* the gate fires -- even if the gate's own
    # notify fails (audit outage), the project is already correctly
    # flagged, not left `NULL` (which would look "never scaffolded" and
    # redo every step above on the next run).
    await set_feature_dispatch_held(conn, tenant_id=tenant_id, project_iri=project_iri, held=True)
    await deps.emit_audit(
        conn,
        AuditEvent(
            tenant_id=tenant_id,
            event_type="rich_scaffold_applied",
            actor_iri=BUILD_PRINCIPAL_IRI,
            subject_iri=project_iri,
            payload={"repo_url": row.repo_url or ""},
            engine="build",
        ),
    )
    await fire_hitl_gate(
        conn,
        HitlGateContext(
            tenant_id=tenant_id,
            task_id=f"env_verification:{project_iri}",
            submitting_principal_iri=BUILD_PRINCIPAL_IRI,
            evidence=_ENV_VERIFICATION_EVIDENCE,
        ),
    )


async def approve_env_verification(
    conn: asyncpg.Connection,
    *,
    project_iri: str,
    tenant_id: str,
    approving_principal_iri: str,
    resolve_principal: Callable[..., Awaitable[_HasPrincipalType]] = get_principal,
) -> None:
    """AC-7: the sole release path for `feature_dispatch_held` -- D9
    no-self-approval inherited from the M1 HITL gate (design decision:
    "no new approval flow"). The submitting principal is always the
    build-engine *service* actor (never a specific human), so "non-self"
    here means the approver must resolve to a real, registered **human**
    principal -- a service/agent principal approving its own scaffold is
    the self-approval this rejects.
    """
    principal = await resolve_principal(conn, tenant_id=tenant_id, iri=approving_principal_iri)
    if principal.type != "human":
        raise SelfApprovalNotPermitted(approving_principal_iri)
    await set_feature_dispatch_held(conn, tenant_id=tenant_id, project_iri=project_iri, held=False)
