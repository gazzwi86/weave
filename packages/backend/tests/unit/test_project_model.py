"""BE-TASK-001 unit tests: deterministic slug + project-IRI construction
(AC-1's `project_iri` scheme, no DB required), plus the DB-layer functions
(`create_project`/`get_project`/`find_existing_project_iri`) exercised
against a `_FakeConnection` stand-in -- same pattern as
`test_members.py`'s `activate_member` tests -- so these are provably
covered without needing docker/Postgres.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import asyncpg
import pytest

from weave_backend.projects.model import (
    NewProject,
    ProjectExists,
    build_project_iri,
    create_project,
    find_existing_project_iri,
    get_project,
    slugify,
)


def test_slugify_lowercases_and_hyphenates() -> None:
    assert slugify("Acme Corp Website") == "acme-corp-website"


def test_slugify_collapses_punctuation_into_a_single_hyphen() -> None:
    assert slugify("Acme & Co.,  Ltd!!") == "acme-co-ltd"


def test_slugify_strips_leading_and_trailing_hyphens() -> None:
    assert slugify("  -Acme-  ") == "acme"


def test_build_project_iri_from_tenant_and_slugified_name() -> None:
    assert build_project_iri("tenant-a", "acme-corp") == "urn:weave:project:tenant-a:acme-corp"


class _FakeRow(dict[str, Any]):
    """dict subclass -- stands in for an asyncpg.Record (supports `row["x"]`)."""


class _FakeConnection:
    """Stands in for asyncpg.Connection (see test_members.py precedent)."""

    def __init__(
        self, *, fetchrow_result: _FakeRow | None = None, raise_unique_violation: bool = False
    ) -> None:
        self._fetchrow_result = fetchrow_result
        self._raise_unique_violation = raise_unique_violation

    async def fetchrow(self, _query: str, *_args: Any) -> _FakeRow | None:
        if self._raise_unique_violation:
            raise asyncpg.UniqueViolationError("duplicate key")
        return self._fetchrow_result


async def test_find_existing_project_iri_returns_iri_when_row_found() -> None:
    conn = _FakeConnection(fetchrow_result=_FakeRow(project_iri="urn:weave:project:t1:acme"))
    result = await find_existing_project_iri(conn, tenant_id="t1", slug="acme")
    assert result == "urn:weave:project:t1:acme"


async def test_find_existing_project_iri_returns_none_when_no_row() -> None:
    conn = _FakeConnection(fetchrow_result=None)
    result = await find_existing_project_iri(conn, tenant_id="t1", slug="acme")
    assert result is None


async def test_create_project_returns_project_on_success() -> None:
    now = datetime.now(UTC)
    conn = _FakeConnection(
        fetchrow_result=_FakeRow(
            project_iri="urn:weave:project:t1:acme",
            name="Acme",
            pinned_graph_version_iri="urn:weave:version:v1",
            created_at=now,
        )
    )
    fields = NewProject(
        tenant_id="t1",
        slug="acme",
        name="Acme",
        description=None,
        pinned_graph_version_iri="urn:weave:version:v1",
    )

    project = await create_project(conn, fields)

    assert project.project_iri == "urn:weave:project:t1:acme"
    assert project.created_at == now


async def test_create_project_raises_project_exists_on_race_condition_duplicate() -> None:
    conn = _FakeConnection(raise_unique_violation=True)
    fields = NewProject(
        tenant_id="t1",
        slug="acme",
        name="Acme",
        description=None,
        pinned_graph_version_iri="urn:weave:version:v1",
    )

    with pytest.raises(ProjectExists) as exc_info:
        await create_project(conn, fields)

    assert exc_info.value.existing_iri == "urn:weave:project:t1:acme"


async def test_get_project_returns_project_when_found() -> None:
    now = datetime.now(UTC)
    conn = _FakeConnection(
        fetchrow_result=_FakeRow(
            project_iri="urn:weave:project:t1:acme",
            name="Acme",
            pinned_graph_version_iri="urn:weave:version:v1",
            created_at=now,
        )
    )

    project = await get_project(conn, tenant_id="t1", project_iri="urn:weave:project:t1:acme")

    assert project is not None
    assert project.name == "Acme"


async def test_get_project_returns_none_when_not_found() -> None:
    conn = _FakeConnection(fetchrow_result=None)

    project = await get_project(conn, tenant_id="t1", project_iri="urn:weave:project:t1:missing")

    assert project is None
