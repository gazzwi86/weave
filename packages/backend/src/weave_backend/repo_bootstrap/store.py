"""BE-TASK-010 (build-engine EPIC-011) DB access on `projects`: reads the
`source_control_*` config BE-TASK-001 persisted (never echoed by that
task's own response schema -- see its progress summary) and reads/writes
the `repo_*` handle columns this task's migration (0010) adds.
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


async def fetch_project_repo_row(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> ProjectRepoRow | None:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        "SELECT name, source_control_provider, source_control_token_secret_ref,"
        " repo_provider, repo_url, repo_default_branch, repo_id"
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
