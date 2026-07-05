"""AC-5: paginated listing against a stub asyncpg connection (no real
Postgres -- `listing.py`'s only DB interaction is `fetch`/`fetchrow`, both
fakeable, matching `test_settings_resolver.py`'s precedent).
"""

from __future__ import annotations

import json
from typing import Any

from weave_backend.audit.listing import list_entries

_TENANT = "tenant-abc"


def _row(seq: int, event_type: str = "workspace.created") -> dict[str, Any]:
    return {
        "seq": seq,
        "ts": f"2026-07-05T00:00:{seq:02d}+00:00",
        "tenant_id": _TENANT,
        "actor_principal_iri": "urn:weave:principal:tenant-abc:human:alice",
        "engine": "platform",
        "event_type": event_type,
        "target_iri": "urn:weave:workspace:tenant-abc:ws-1",
        "diff_summary": json.dumps({"n": seq}),
        "prev_hash": "0" * 64,
        "hash": "a" * 64,
        "signature": "b" * 128,
    }


class _FakeConnection:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    async def fetch(self, _query: str, *args: Any) -> list[dict[str, Any]]:
        _tenant_id, event_type, per_page, offset = args
        filtered = [r for r in self.rows if event_type is None or r["event_type"] == event_type]
        return filtered[offset : offset + per_page]

    async def fetchrow(self, _query: str, *args: Any) -> dict[str, Any]:
        _tenant_id, event_type = args
        filtered = [r for r in self.rows if event_type is None or r["event_type"] == event_type]
        return {"c": len(filtered)}


async def test_list_entries_paginates_most_recent_first() -> None:
    conn = _FakeConnection([_row(3), _row(2), _row(1)])

    page = await list_entries(conn, tenant_id=_TENANT, page=1, per_page=2, event_type=None)

    assert [e.seq for e in page.entries] == [3, 2]
    assert page.total == 3
    assert page.entries[0].diff_summary == {"n": 3}


async def test_list_entries_filters_by_event_type() -> None:
    conn = _FakeConnection([_row(2, "member.invited"), _row(1, "workspace.created")])

    page = await list_entries(
        conn, tenant_id=_TENANT, page=1, per_page=50, event_type="member.invited"
    )

    assert [e.seq for e in page.entries] == [2]
    assert page.total == 1


async def test_list_entries_returns_empty_page_when_no_rows() -> None:
    conn = _FakeConnection([])

    page = await list_entries(conn, tenant_id=_TENANT, page=1, per_page=50, event_type=None)

    assert page.entries == []
    assert page.total == 0
