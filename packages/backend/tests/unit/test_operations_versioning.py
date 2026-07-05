"""CE-TASK-001/002 unit tests: pure semver-bump helper, plus CE-TASK-002's
lifecycle/latest-resolution orchestration mocked at the asyncpg boundary
(AC-002-06/-07/-08). The real draft-default/publish-immutability DB
behaviour is proven for real in the docker-marked integration suite --
these tests only prove `versioning.py` issues the right query/branch for a
given row shape, without needing Postgres.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock

import pytest

from weave_backend.operations import versioning
from weave_backend.operations.versioning import _bump_patch


def test_bump_patch_increments_final_segment() -> None:
    assert _bump_patch("0.1.0") == "0.1.1"


def test_bump_patch_only_touches_the_patch_segment() -> None:
    assert _bump_patch("1.9.4") == "1.9.5"


def _row(**overrides: Any) -> dict[str, Any]:
    base = {
        "semver": "0.1.0",
        "status": "draft",
        "created_at": datetime.now(UTC),
        "published_at": None,
        "actor_iri": "urn:weave:principal:user:u1",
        "workspace_id": "w1",
    }
    base.update(overrides)
    return base


async def test_resolve_version_passes_through_an_explicit_version_iri() -> None:
    """AC-002-08 only special-cases the literal `latest` -- any other value
    is returned unchanged, no DB round trip (existence is the caller's job).
    """
    conn = AsyncMock()

    resolved = await versioning.resolve_version(
        conn, tenant_id="t1", workspace_id="w1", version="urn:weave:tenant:t1:ws:w1:v0.1.0"
    )

    assert resolved == "urn:weave:tenant:t1:ws:w1:v0.1.0"
    conn.fetchrow.assert_not_called()


async def test_resolve_version_latest_resolves_to_newest_published_row() -> None:
    conn = AsyncMock()
    conn.fetchrow.return_value = {"version_iri": "urn:weave:tenant:t1:ws:w1:v0.2.0"}

    resolved = await versioning.resolve_version(
        conn, tenant_id="t1", workspace_id="w1", version="latest"
    )

    assert resolved == "urn:weave:tenant:t1:ws:w1:v0.2.0"
    query = conn.fetchrow.call_args.args[0]
    assert "status = 'published'" in query
    assert "ORDER BY created_at DESC" in query


async def test_resolve_version_latest_raises_when_no_published_version_exists() -> None:
    conn = AsyncMock()
    conn.fetchrow.return_value = None

    with pytest.raises(versioning.VersionNotFound):
        await versioning.resolve_version(conn, tenant_id="t1", workspace_id="w1", version="latest")


async def test_publish_version_transitions_a_draft_row() -> None:
    conn = AsyncMock()
    conn.fetchrow.return_value = _row(status="published", published_at=datetime.now(UTC))

    result = await versioning.publish_version(
        conn, tenant_id="t1", workspace_id="w1", version_iri="urn:weave:tenant:t1:ws:w1:v0.1.0"
    )

    assert result.status == "published"
    assert result.published_at is not None
    update_query = conn.fetchrow.call_args.args[0]
    assert "SET status = 'published'" in update_query
    assert "AND status = 'draft'" in update_query


async def test_publish_version_already_published_raises_without_fetching_existing_twice(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-002-09: republishing an already-published version is rejected, not
    silently re-applied."""
    conn = AsyncMock()
    conn.fetchrow.return_value = None  # UPDATE ... WHERE status='draft' matched nothing
    monkeypatch.setattr(
        versioning,
        "get_version",
        AsyncMock(return_value=versioning.GraphVersion(**_row(version_iri="v1"))),
    )

    with pytest.raises(versioning.VersionAlreadyPublished):
        await versioning.publish_version(
            conn, tenant_id="t1", workspace_id="w1", version_iri="v1"
        )


async def test_publish_version_missing_row_raises_version_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = AsyncMock()
    conn.fetchrow.return_value = None
    monkeypatch.setattr(versioning, "get_version", AsyncMock(return_value=None))

    with pytest.raises(versioning.VersionNotFound):
        await versioning.publish_version(
            conn, tenant_id="t1", workspace_id="w1", version_iri="v1"
        )
