"""BE-TASK-010 (build-engine EPIC-011) DB access on `projects`: reads the
`source_control_*` config BE-TASK-001 persisted (never echoed by that
task's own response schema -- see its progress summary) and reads/writes
the `repo_*` handle columns this task's migration (0010) adds, plus
`feature_dispatch_held` (TASK-006 AC-7, migration 0030).
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from weave_backend.repo_bootstrap.drivers import RepoHandle


@dataclass(frozen=True)
class ProjectRepoRow:
    name: str
    source_control_provider: str | None
    source_control_token_secret_ref: str | None
    repo_provider: str | None
    repo_url: str | None
    repo_default_branch: str | None
    repo_id: str | None = None
    feature_dispatch_held: bool | None = None


async def fetch_project_repo_row(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> ProjectRepoRow | None:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        "SELECT name, source_control_provider, source_control_token_secret_ref,"
        " repo_provider, repo_url, repo_default_branch, repo_id, feature_dispatch_held"
        " FROM projects WHERE tenant_id = $1 AND project_iri = $2",
        tenant_id,
        project_iri,
    )
    if row is None:
        return None
    return ProjectRepoRow(
        name=row["name"],
        source_control_provider=row["source_control_provider"],
        source_control_token_secret_ref=row["source_control_token_secret_ref"],
        repo_provider=row["repo_provider"],
        repo_url=row["repo_url"],
        repo_default_branch=row["repo_default_branch"],
        repo_id=row["repo_id"],
        # `.get`, not `[]`: real asyncpg rows always carry every selected
        # column, but pre-existing fake-connection test fixtures (dicts
        # built before migration 0030) don't yet -- tolerate that rather
        # than forcing every one of them to add the new key.
        feature_dispatch_held=row.get("feature_dispatch_held"),
    )


async def set_project_repo(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, provider: str, repo: RepoHandle
) -> None:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        "UPDATE projects SET repo_provider = $1, repo_url = $2, repo_default_branch = $3,"
        " repo_id = $4 WHERE tenant_id = $5 AND project_iri = $6",
        provider,
        repo.url,
        repo.default_branch,
        repo.repo_id,
        tenant_id,
        project_iri,
    )


async def set_feature_dispatch_held(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, held: bool
) -> None:
    """TASK-006 AC-7: the sole writer of `feature_dispatch_held` -- `True`
    when `rich_scaffold` fires the env-verification gate, `False` when
    `approve_env_verification` releases it (`rich_scaffold`'s own
    idempotency check treats either as "already scaffolded").
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        "UPDATE projects SET feature_dispatch_held = $1"
        " WHERE tenant_id = $2 AND project_iri = $3",
        held,
        tenant_id,
        project_iri,
    )
