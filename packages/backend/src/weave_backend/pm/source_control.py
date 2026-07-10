"""TASK-023 (E2-S6, FR-061/B9) `.../source-control` repo layer. Persists on
the existing `projects.source_control_provider` /
`projects.source_control_token_secret_ref` columns (migration 0009) --
never a token value, only the Secrets Manager reference (AC-1/AC-2).

`configured_by`/`configured_at` are read from `audit_entries` (the latest
`build.source_control.configured` event for this project) rather than new
columns -- ADR-002 (build-engine decisions): the brief's own Data Model note
says "no new columns", and PLAT-AUDIT-1 already durably records actor+ts for
every mutation.
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

CONFIGURED_EVENT_TYPE = "build.source_control.configured"


@dataclass(frozen=True)
class SourceControlConfig:
    provider: str
    token_secret_ref: str


@dataclass(frozen=True)
class ConfiguredMeta:
    configured_by: str
    configured_at: str


async def get_row(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> SourceControlConfig | None:
    """`None` covers both "no such project" and "project exists but has no
    source control configured yet" -- the router (and the frontend, AC-5)
    treat both identically as the unconfigured/setup state.
    """
    row = await conn.fetchrow(
        "SELECT source_control_provider, source_control_token_secret_ref"
        " FROM projects WHERE tenant_id = $1 AND project_iri = $2",
        tenant_id,
        project_iri,
    )
    if row is None or row["source_control_provider"] is None:
        return None
    return SourceControlConfig(
        provider=row["source_control_provider"],
        token_secret_ref=row["source_control_token_secret_ref"],
    )


async def project_exists(conn: asyncpg.Connection, *, tenant_id: str, project_iri: str) -> bool:
    """Existence-only check used by the PUT route before writing to Secrets
    Manager -- avoids creating an orphaned secret for a project that turns
    out not to exist (checked ahead of the write, not after).
    """
    row = await conn.fetchrow(
        "SELECT 1 FROM projects WHERE tenant_id = $1 AND project_iri = $2",
        tenant_id,
        project_iri,
    )
    return row is not None


async def set_row(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    project_iri: str,
    provider: str,
    token_secret_ref: str,
) -> None:
    """AC-2: persists the provider + secret reference only -- never a
    token value passes through this function.
    """
    await conn.execute(
        "UPDATE projects SET source_control_provider = $1, source_control_token_secret_ref = $2"
        " WHERE tenant_id = $3 AND project_iri = $4",
        provider,
        token_secret_ref,
        tenant_id,
        project_iri,
    )


async def get_configured_meta(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> ConfiguredMeta | None:
    """Latest `build.source_control.configured` audit entry for this
    project -- the source of the GET response's `configured_by`/
    `configured_at` (no dedicated columns, see module docstring).
    """
    row = await conn.fetchrow(
        "SELECT actor_principal_iri, ts FROM audit_entries"
        " WHERE tenant_id = $1 AND target_iri = $2 AND event_type = $3"
        " ORDER BY seq DESC LIMIT 1",
        tenant_id,
        project_iri,
        CONFIGURED_EVENT_TYPE,
    )
    if row is None:
        return None
    return ConfiguredMeta(configured_by=row["actor_principal_iri"], configured_at=row["ts"])
