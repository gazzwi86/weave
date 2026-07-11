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
    update_project_pin,
    update_project_publish,
    update_project_write_back,
)


def test_slugify_lowercases_and_hyphenates() -> None:
    assert slugify("Acme Corp Website") == "acme-corp-website"


def test_slugify_collapses_punctuation_into_a_single_hyphen() -> None:
    assert slugify("Acme & Co.,  Ltd!!") == "acme-co-ltd"


def test_slugify_strips_leading_and_trailing_hyphens() -> None:
    assert slugify("  -Acme-  ") == "acme"


def test_build_project_iri_from_tenant_and_slugified_name() -> None:
    assert build_project_iri("tenant-a", "acme-corp") == "urn:weave:project:tenant-a:acme-corp"


@pytest.mark.parametrize("name", ["🎉🎉🎉", "!!!", "___", "---"])
def test_slugify_returns_empty_string_for_punctuation_or_emoji_only_input(name: str) -> None:
    """QA edge case (BE-TASK-001): a name that is non-empty and non-whitespace
    (so it survives the router's `not body.name.strip()` AC-6 gate) can still
    slugify to `""`. The `projects` table has `CHECK (slug <> '')`, and
    nothing between `slugify()` and the INSERT validates this, so this input
    reaches the DB and raises an unhandled `asyncpg.CheckViolationError`
    (proven end-to-end by
    `test_create_project_emoji_only_name_returns_422_not_500` in the
    integration suite) instead of AC-6's `422`. See QA failure report.
    """
    assert slugify(name) == ""


class _FakeRow(dict[str, Any]):
    """dict subclass -- stands in for an asyncpg.Record (supports `row["x"]`)."""


class _FakeConnection:
    """Stands in for asyncpg.Connection (see test_members.py precedent)."""

    def __init__(
        self, *, fetchrow_result: _FakeRow | None = None, raise_unique_violation: bool = False
    ) -> None:
        self._fetchrow_result = fetchrow_result
        self._raise_unique_violation = raise_unique_violation
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    async def fetchrow(self, _query: str, *_args: Any) -> _FakeRow | None:
        if self._raise_unique_violation:
            raise asyncpg.UniqueViolationError("duplicate key")
        return self._fetchrow_result

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))


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
            demo_output_location_ref="s3://weave-artefacts/t1/run-1/",
            write_back_complete=True,
            write_back_artefact_iri="urn:weave:artefact:t1:run-1",
            last_sdk_version_iri=None,
            sdk_generation_count=0,
        )
    )

    project = await get_project(conn, tenant_id="t1", project_iri="urn:weave:project:t1:acme")

    assert project is not None
    assert project.name == "Acme"
    assert project.demo_output_location_ref == "s3://weave-artefacts/t1/run-1/"
    assert project.write_back_complete is True
    assert project.write_back_artefact_iri == "urn:weave:artefact:t1:run-1"
    assert project.last_sdk_version_iri is None
    assert project.sdk_generation_count == 0


async def test_get_project_returns_none_when_not_found() -> None:
    conn = _FakeConnection(fetchrow_result=None)

    project = await get_project(conn, tenant_id="t1", project_iri="urn:weave:project:t1:missing")

    assert project is None


async def test_update_project_publish_sets_demo_output_location_ref() -> None:
    conn = _FakeConnection()

    await update_project_publish(
        conn,
        tenant_id="t1",
        project_iri="urn:weave:project:t1:acme",
        demo_output_location_ref="s3://weave-artefacts/t1/run-1/",
    )

    [(query, args)] = conn.executed
    assert "demo_output_location_ref" in query
    assert args == ("s3://weave-artefacts/t1/run-1/", "t1", "urn:weave:project:t1:acme")


async def test_update_project_write_back_sets_complete_and_artefact_iri() -> None:
    conn = _FakeConnection()

    await update_project_write_back(
        conn,
        tenant_id="t1",
        project_iri="urn:weave:project:t1:acme",
        write_back_artefact_iri="urn:weave:artefact:t1:run-1",
    )

    [(query, args)] = conn.executed
    assert "write_back_complete" in query
    assert "write_back_artefact_iri" in query
    assert args == ("urn:weave:artefact:t1:run-1", "t1", "urn:weave:project:t1:acme")


async def test_update_project_pin_sets_pinned_graph_version_iri() -> None:
    """TASK-016 AC-4: single-column pin update -- mirrors
    `update_project_write_back`'s pattern.
    """
    conn = _FakeConnection()

    await update_project_pin(
        conn,
        tenant_id="t1",
        project_iri="urn:weave:project:t1:acme",
        pinned_graph_version_iri="urn:weave:version:v2",
    )

    [(query, args)] = conn.executed
    assert "pinned_graph_version_iri" in query
    assert args == ("urn:weave:version:v2", "t1", "urn:weave:project:t1:acme")
