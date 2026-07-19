"""AC-1: workspace creation mints a named-graph IRI atomically and a
duplicate (tenant_id, slug) is rejected with a typed error the router turns
into 409.

Uses a stub asyncpg connection (no real Postgres) -- `create_workspace`'s
only DB interaction is a single ``fetchrow``/``UniqueViolationError``, both
trivially fakeable, so this stays a true unit test.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import asyncpg
import pytest

from weave_backend.tenancy.workspaces import (
    WorkspaceSlugTaken,
    create_workspace,
    update_workspace_description,
)


class _FakeConnection:
    """Records the INSERT args and either returns a row or raises the same
    unique-violation asyncpg itself would raise for a duplicate slug.
    """

    def __init__(self, *, raise_unique_violation: bool = False) -> None:
        self.raise_unique_violation = raise_unique_violation
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any]:
        self.calls.append((query, args))
        if self.raise_unique_violation:
            raise asyncpg.UniqueViolationError("duplicate key value")
        _id, _tenant_id, slug, display_name, named_graph_iri = args
        return {
            "id": _id,
            "slug": slug,
            "display_name": display_name,
            "named_graph_iri": named_graph_iri,
            "description": None,
            "created_at": datetime.now(UTC),
        }


class _FakeUpdateConnection:
    """Records the UPDATE args and returns a row (or None -- no workspace
    matched `(tenant_id, id)`) same shape as `update_workspace_description`'s
    real `UPDATE ... RETURNING` -- SE1 (docs/design/remediation-2-api-gaps.md).
    """

    def __init__(self, *, row: dict[str, Any] | None) -> None:
        self.row = row
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        self.calls.append((query, args))
        return self.row


async def test_workspace_create_mints_named_graph_iri() -> None:
    conn = _FakeConnection()

    workspace = await create_workspace(
        conn,
        tenant_id="acme-corp",
        slug="engineering",
        display_name="Engineering",
    )

    assert workspace.slug == "engineering"
    assert workspace.named_graph_iri.startswith("urn:weave:tenant:acme-corp:ws:")
    assert workspace.named_graph_iri.endswith(workspace.id)


async def test_workspace_create_rejects_duplicate_slug() -> None:
    conn = _FakeConnection(raise_unique_violation=True)

    with pytest.raises(WorkspaceSlugTaken):
        await create_workspace(
            conn,
            tenant_id="acme-corp",
            slug="engineering",
            display_name="Engineering (again)",
        )


async def test_workspace_create_defaults_description_to_none() -> None:
    conn = _FakeConnection()

    workspace = await create_workspace(
        conn, tenant_id="acme-corp", slug="engineering", display_name="Engineering"
    )

    assert workspace.description is None


async def test_update_workspace_description_returns_the_updated_row() -> None:
    conn = _FakeUpdateConnection(
        row={
            "id": "w-1",
            "slug": "engineering",
            "display_name": "Engineering",
            "named_graph_iri": "urn:w1",
            "description": "Ships the platform.",
            "created_at": datetime.now(UTC),
        }
    )

    workspace = await update_workspace_description(
        conn, tenant_id="acme-corp", workspace_id="w-1", description="Ships the platform."
    )

    assert workspace is not None
    assert workspace.description == "Ships the platform."
    query, args = conn.calls[0]
    assert "UPDATE workspaces" in query
    assert args == ("Ships the platform.", "acme-corp", "w-1")


async def test_update_workspace_description_returns_none_when_workspace_not_found() -> None:
    conn = _FakeUpdateConnection(row=None)

    workspace = await update_workspace_description(
        conn, tenant_id="acme-corp", workspace_id="missing", description="x"
    )

    assert workspace is None
