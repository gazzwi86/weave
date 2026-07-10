"""BE-TASK-001 (build-engine EPIC-002): project record creation + lookup.

Mirrors ``tenancy/workspaces.py``'s shape (deterministic-id-plus-IRI insert,
``UniqueViolationError`` -> a named domain exception) but the project IRI
here is fully deterministic from ``(tenant_id, slug)`` -- no ``uuid4()`` --
so a racing duplicate insert can report back the exact IRI the caller was
about to mint anyway (AC-5).
"""

from __future__ import annotations

import re
from datetime import date, datetime

import asyncpg
from pydantic import BaseModel


class ProjectExists(Exception):
    """Raised when a project already exists for this ``(tenant_id, slug)``."""

    def __init__(self, existing_iri: str) -> None:
        super().__init__(existing_iri)
        self.existing_iri = existing_iri


class Project(BaseModel):
    project_iri: str
    name: str
    pinned_graph_version_iri: str
    created_at: datetime
    # BE-TASK-009 (migration 0016): write-back state. Defaulted so every
    # existing `Project(...)` construction elsewhere keeps compiling.
    demo_output_location_ref: str | None = None
    write_back_complete: bool = False
    write_back_artefact_iri: str | None = None
    # TASK-009 (migration 0021): FR-034 release-plan fields (ADR-020) --
    # nullable, population deferred to a future task; `render_release_plan`
    # shows "TBD" on unset rather than fabricating a value.
    signoff_roles: list[str] | None = None
    target_date: date | None = None


class NewProject(BaseModel):
    """Grouped input for `create_project` -- keeps the function under Law E's
    5-parameter budget (`tenant_id`/`slug`/`name`/`description`/pinned
    version/source-control provider+ref would otherwise be 8).
    """

    tenant_id: str
    slug: str
    name: str
    description: str | None
    pinned_graph_version_iri: str
    source_control_provider: str | None = None
    source_control_token_secret_ref: str | None = None


def slugify(name: str) -> str:
    """Lowercase, hyphenated, stable slug -- deterministic so the same name
    always produces the same ``project_iri`` (AC-1).

    ponytail: a few lines of stdlib ``re`` covers this; no need for the
    ``python-slugify`` dependency the brief's implementation hint suggested.
    Nothing else in this codebase auto-generates a slug from free text yet
    (workspace slugs are user-supplied, see ``schemas/tenancy.py``), so
    there's no existing helper to reuse either -- this is the first one.
    """
    lowered = name.strip().lower()
    hyphenated = re.sub(r"[^a-z0-9]+", "-", lowered)
    return hyphenated.strip("-")


def build_project_iri(tenant_id: str, slug: str) -> str:
    """Deterministic project IRI (AC-1): ``urn:weave:project:{tenant_id}:{slug}``.

    Same ``(tenant_id, slug)`` always yields the same IRI, so a racing
    duplicate insert can report back the exact IRI it collided with (AC-5)
    without a re-query.
    """
    return f"urn:weave:project:{tenant_id}:{slug}"


async def find_existing_project_iri(
    conn: asyncpg.Connection, *, tenant_id: str, slug: str
) -> str | None:
    """Pre-check for AC-5's 409: the existing ``project_iri`` for this
    ``(tenant_id, slug)`` pair, or ``None`` if no such project exists yet.
    """
    # False positive: static literal SQL; tenant_id/slug are bound as
    # positional parameters ($1/$2), never interpolated into the query text.
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        "SELECT project_iri FROM projects WHERE tenant_id = $1 AND slug = $2",
        tenant_id,
        slug,
    )
    return str(row["project_iri"]) if row is not None else None


async def create_project(conn: asyncpg.Connection, fields: NewProject) -> Project:
    """Insert a new project row and return it (AC-1).

    Raises `ProjectExists` if a concurrent request already won the
    ``(tenant_id, slug)`` unique constraint between the caller's own
    `find_existing_project_iri` pre-check and this insert (AC-5).
    """
    project_iri = build_project_iri(fields.tenant_id, fields.slug)
    try:
        # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
        row = await conn.fetchrow(
            """
            INSERT INTO projects (
                project_iri, tenant_id, slug, name, description,
                pinned_graph_version_iri, source_control_provider,
                source_control_token_secret_ref
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING project_iri, name, pinned_graph_version_iri, created_at
            """,
            project_iri,
            fields.tenant_id,
            fields.slug,
            fields.name,
            fields.description,
            fields.pinned_graph_version_iri,
            fields.source_control_provider,
            fields.source_control_token_secret_ref,
        )
    except asyncpg.UniqueViolationError as exc:
        # Race-condition duplicate (pseudocode): another request for the
        # same (tenant_id, slug) won between our pre-check and this insert.
        # The IRI is deterministic, so we already know what it collided
        # with -- no need to re-query.
        raise ProjectExists(project_iri) from exc
    return Project(
        project_iri=row["project_iri"],
        name=row["name"],
        pinned_graph_version_iri=row["pinned_graph_version_iri"],
        created_at=row["created_at"],
    )


async def get_project(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> Project | None:
    """Fetch a project by IRI, scoped to `tenant_id` (AC-4 -- RLS also
    enforces this at the DB level; the explicit filter here is
    defence-in-depth, not the sole guard). Returns `None` if not found or
    owned by a different tenant, so the router can turn that into a 404.
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        "SELECT project_iri, name, pinned_graph_version_iri, created_at,"
        " demo_output_location_ref, write_back_complete, write_back_artefact_iri"
        " FROM projects WHERE tenant_id = $1 AND project_iri = $2",
        tenant_id,
        project_iri,
    )
    if row is None:
        return None
    return Project(
        project_iri=row["project_iri"],
        name=row["name"],
        pinned_graph_version_iri=row["pinned_graph_version_iri"],
        created_at=row["created_at"],
        demo_output_location_ref=row["demo_output_location_ref"],
        write_back_complete=row["write_back_complete"],
        write_back_artefact_iri=row["write_back_artefact_iri"],
    )


async def update_project_publish(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, demo_output_location_ref: str
) -> None:
    """AC-1: record the durable S3 location of the published bundle."""
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        "UPDATE projects SET demo_output_location_ref = $1"
        " WHERE tenant_id = $2 AND project_iri = $3",
        demo_output_location_ref,
        tenant_id,
        project_iri,
    )


async def update_project_pin(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, pinned_graph_version_iri: str
) -> None:
    """TASK-016 AC-4: upgrade the project's ontology pin. Called inside the
    same ``tenant_connection`` transaction as the audit entry (atomic).
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        "UPDATE projects SET pinned_graph_version_iri = $1"
        " WHERE tenant_id = $2 AND project_iri = $3",
        pinned_graph_version_iri,
        tenant_id,
        project_iri,
    )


async def update_project_write_back(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, write_back_artefact_iri: str
) -> None:
    """AC-7: mark the CE-WRITE-1 commit complete and record the resolvable
    BE-ARTEFACT-1 IRI. Only called on a 201 (committed) response -- never on
    a 422 (rejected) or 503 (unavailable) outcome.
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        "UPDATE projects SET write_back_complete = true, write_back_artefact_iri = $1"
        " WHERE tenant_id = $2 AND project_iri = $3",
        write_back_artefact_iri,
        tenant_id,
        project_iri,
    )
