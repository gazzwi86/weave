"""BE-TASK-010 (build-engine EPIC-011, FR-061): run step 0 -- create or
reuse the external GitHub/GitLab repo a project's generated output lives
in, and write the boilerplate/harness initial commit. Fail-closed: an
unconfigured provider or invalid token halts the run (TASK-006) before
PLAN, never falling back to writing inside Weave (decision B9).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import asyncpg

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.projects.model import slugify
from weave_backend.repo_bootstrap.drivers import (
    SUPPORTED_PROVIDERS,
    AuthError,
    ScmDriver,
    get_scm_driver,
)
from weave_backend.repo_bootstrap.harness_template import render_project_harness
from weave_backend.repo_bootstrap.secrets import get_scm_token
from weave_backend.repo_bootstrap.store import (
    ProjectRepoRow,
    fetch_project_repo_row,
    set_project_repo,
)

#: Attributed as the audit actor (AC-6) -- a system/run-step action, not a
#: human/agent `Principal` (none is in scope at run-step time).
BUILD_SERVICE_PRINCIPAL_IRI = "urn:weave:principal:service:build-engine"

_REPO_NAME_PREFIX = "weave-"


class RepoBootstrapError(Exception):
    """Fail-closed, run-halting error (AC-4): `reason` is
    `repo_provider_unconfigured` or `repo_auth_invalid`.
    """

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class ProjectNotFoundError(Exception):
    """Raised when `project_iri` does not resolve for `tenant_id`
    (pseudocode's "404 if missing").
    """


async def _default_emit_audit(conn: asyncpg.Connection, event: AuditEvent) -> None:
    await default_audit_emitter.emit(conn, event)


@dataclass(frozen=True)
class RepoBootstrapDeps:
    """Groups the three injectable side-effecting collaborators so
    `ensure_project_repo` stays under Law E's 5-parameter budget (mirrors
    `NewProject`'s grouping precedent in `projects/model.py`).
    """

    get_secret: Callable[[str], Awaitable[str | None]]
    driver_for: Callable[[str], ScmDriver]
    emit_audit: Callable[[asyncpg.Connection, AuditEvent], Awaitable[None]]


DEFAULT_DEPS = RepoBootstrapDeps(
    get_secret=get_scm_token, driver_for=get_scm_driver, emit_audit=_default_emit_audit
)


def _repo_name(project_name: str) -> str:
    return f"{_REPO_NAME_PREFIX}{slugify(project_name)}"


def _existing_repo(row: ProjectRepoRow) -> tuple[int, dict[str, str]] | None:
    if row.repo_provider and row.repo_url and row.repo_default_branch:
        return 200, {
            "provider": row.repo_provider,
            "repo_url": row.repo_url,
            "default_branch": row.repo_default_branch,
        }
    return None


async def _resolve_token(row: ProjectRepoRow, deps: RepoBootstrapDeps) -> str:
    if row.source_control_token_secret_ref:
        token = await deps.get_secret(row.source_control_token_secret_ref)
        if token:
            return token
    raise RepoBootstrapError("repo_auth_invalid")


async def ensure_project_repo(
    conn: asyncpg.Connection,
    *,
    project_iri: str,
    tenant_id: str,
    deps: RepoBootstrapDeps = DEFAULT_DEPS,
) -> tuple[int, dict[str, str]]:
    """AC-1..AC-7: the run's first step (TASK-006 invokes this before PLAN).
    Idempotent (AC-3); fails closed on an unconfigured provider or invalid
    token (AC-4) without ever writing inside Weave.
    """
    row = await fetch_project_repo_row(conn, tenant_id=tenant_id, project_iri=project_iri)
    if row is None:
        raise ProjectNotFoundError(project_iri)

    existing = _existing_repo(row)
    if existing is not None:
        return existing

    provider = row.source_control_provider
    if not provider or provider not in SUPPORTED_PROVIDERS:
        raise RepoBootstrapError("repo_provider_unconfigured")

    token = await _resolve_token(row, deps)

    driver = deps.driver_for(provider)
    try:
        repo = await driver.create_repo(name=_repo_name(row.name), private=True, token=token)
    except AuthError as exc:
        raise RepoBootstrapError("repo_auth_invalid") from exc

    boilerplate = render_project_harness(project_name=row.name, provider=provider)
    await driver.write_initial_commit(repo, boilerplate=boilerplate, token=token)

    await set_project_repo(
        conn, tenant_id=tenant_id, project_iri=project_iri, provider=provider, repo=repo
    )
    await deps.emit_audit(
        conn,
        AuditEvent(
            tenant_id=tenant_id,
            event_type="repo_bootstrapped",
            actor_iri=BUILD_SERVICE_PRINCIPAL_IRI,
            subject_iri=project_iri,
            payload={"provider": provider, "repo_url": repo.url},
            engine="build",
        ),
    )
    return 201, {"provider": provider, "repo_url": repo.url, "default_branch": repo.default_branch}
