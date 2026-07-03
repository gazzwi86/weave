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

from weave_backend.tenancy.workspaces import WorkspaceSlugTaken, create_workspace


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
            "created_at": datetime.now(UTC),
        }


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
