"""G9 (docs/design/remediation-2-api-gaps.md): `briefs.store.epic_refs` --
project-wide (task_id -> epic_id/epic_title) lookup the epic rollup joins
against the state spine. Fake connection, same "route by SQL substring"
pattern as `test_build_costs.py`'s `_FakeCostsConnection` -- no real
Postgres needed (that proof lives in the docker-marked integration suite).
"""

from __future__ import annotations

from typing import Any

from weave_backend.briefs.store import EpicRef, epic_refs

_TENANT = "t1"
_PROJECT_IRI = "urn:weave:project:t1:acme"


class _FakeBriefsConnection:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        assert "FROM task_briefs" in query
        return self._rows


async def test_epic_refs_maps_task_id_to_brief_epic_fields() -> None:
    conn = _FakeBriefsConnection(
        [
            {"task_id": "t1", "content": {"epic_id": "EPIC-004", "epic_title": "Build"}},
            {"task_id": "t2", "content": {"title": "No epic on this brief"}},
        ]
    )

    result = await epic_refs(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert result["t1"] == EpicRef(epic_id="EPIC-004", epic_title="Build")
    assert result["t2"] == EpicRef(epic_id=None, epic_title=None)


async def test_epic_refs_empty_project_returns_empty_dict() -> None:
    conn = _FakeBriefsConnection([])

    result = await epic_refs(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert result == {}
