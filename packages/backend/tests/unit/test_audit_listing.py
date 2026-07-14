"""AC-5: paginated listing against a stub asyncpg connection (no real
Postgres -- `listing.py`'s only DB interaction is `fetch`/`fetchrow`, both
fakeable, matching `test_settings_resolver.py`'s precedent).
"""

from __future__ import annotations

import json
from typing import Any

from weave_backend.audit.listing import AuditFilters, list_entries

_TENANT = "tenant-abc"


def _row(seq: int, event_type: str = "workspace.created", **overrides: Any) -> dict[str, Any]:
    row = {
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
    row.update(overrides)
    return row


# All seven `PLAT-AUDIT-1` filters, matched against a row using the same
# "None means unfiltered" rule the SQL's `$n::text IS NULL OR ...` guards use.
def _matches(row: dict[str, Any], filters: dict[str, Any]) -> bool:
    checks = (
        filters["engine"] is None or row["engine"] == filters["engine"],
        filters["event_type"] is None or row["event_type"] == filters["event_type"],
        filters["actor_principal_iri"] is None
        or row["actor_principal_iri"] == filters["actor_principal_iri"],
        filters["target_iri"] is None or row["target_iri"] == filters["target_iri"],
        filters["date_from"] is None or row["ts"] >= filters["date_from"],
        filters["date_to"] is None or row["ts"] <= filters["date_to"],
        filters["q"] is None
        or filters["q"].lower() in (row["target_iri"] + row["diff_summary"]).lower(),
    )
    return all(checks)


class _FakeConnection:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def _filtered(self, args: tuple[Any, ...]) -> list[dict[str, Any]]:
        (
            _tenant_id,
            engine,
            event_type,
            actor_principal_iri,
            target_iri,
            date_from,
            date_to,
            q,
        ) = args[:8]
        filters = {
            "engine": engine,
            "event_type": event_type,
            "actor_principal_iri": actor_principal_iri,
            "target_iri": target_iri,
            "date_from": date_from,
            "date_to": date_to,
            "q": q,
        }
        return [r for r in self.rows if _matches(r, filters)]

    async def fetch(self, _query: str, *args: Any) -> list[dict[str, Any]]:
        per_page, offset = args[8], args[9]
        return self._filtered(args)[offset : offset + per_page]

    async def fetchrow(self, _query: str, *args: Any) -> dict[str, Any]:
        return {"c": len(self._filtered(args))}


async def test_list_entries_paginates_most_recent_first() -> None:
    conn = _FakeConnection([_row(3), _row(2), _row(1)])

    page = await list_entries(conn, tenant_id=_TENANT, page=1, per_page=2)

    assert [e.seq for e in page.entries] == [3, 2]
    assert page.total == 3
    assert page.entries[0].diff_summary == {"n": 3}


async def test_list_entries_filters_by_event_type() -> None:
    conn = _FakeConnection([_row(2, "member.invited"), _row(1, "workspace.created")])

    page = await list_entries(
        conn,
        tenant_id=_TENANT,
        page=1,
        per_page=50,
        filters=AuditFilters(event_type="member.invited"),
    )

    assert [e.seq for e in page.entries] == [2]
    assert page.total == 1


async def test_list_entries_returns_empty_page_when_no_rows() -> None:
    conn = _FakeConnection([])

    page = await list_entries(conn, tenant_id=_TENANT, page=1, per_page=50)

    assert page.entries == []
    assert page.total == 0


async def test_list_entries_filters_by_engine() -> None:
    conn = _FakeConnection([_row(2, engine="build"), _row(1, engine="platform")])

    page = await list_entries(
        conn, tenant_id=_TENANT, page=1, per_page=50, filters=AuditFilters(engine="build")
    )

    assert [e.seq for e in page.entries] == [2]
    assert page.total == 1


async def test_list_entries_filters_by_actor_principal_iri() -> None:
    conn = _FakeConnection(
        [
            _row(2, actor_principal_iri="urn:weave:principal:tenant-abc:human:bob"),
            _row(1, actor_principal_iri="urn:weave:principal:tenant-abc:human:alice"),
        ]
    )

    page = await list_entries(
        conn,
        tenant_id=_TENANT,
        page=1,
        per_page=50,
        filters=AuditFilters(actor_principal_iri="urn:weave:principal:tenant-abc:human:bob"),
    )

    assert [e.seq for e in page.entries] == [2]
    assert page.total == 1


async def test_list_entries_filters_by_target_iri() -> None:
    conn = _FakeConnection(
        [
            _row(2, target_iri="urn:weave:workspace:tenant-abc:ws-2"),
            _row(1, target_iri="urn:weave:workspace:tenant-abc:ws-1"),
        ]
    )

    page = await list_entries(
        conn,
        tenant_id=_TENANT,
        page=1,
        per_page=50,
        filters=AuditFilters(target_iri="urn:weave:workspace:tenant-abc:ws-2"),
    )

    assert [e.seq for e in page.entries] == [2]
    assert page.total == 1


async def test_list_entries_filters_by_date_range() -> None:
    conn = _FakeConnection(
        [
            _row(2, ts="2026-07-10T00:00:00+00:00"),
            _row(1, ts="2026-01-01T00:00:00+00:00"),
        ]
    )

    page = await list_entries(
        conn,
        tenant_id=_TENANT,
        page=1,
        per_page=50,
        filters=AuditFilters(
            date_from="2026-06-01T00:00:00+00:00", date_to="2026-12-31T23:59:59+00:00"
        ),
    )

    assert [e.seq for e in page.entries] == [2]
    assert page.total == 1


async def test_list_entries_filters_by_q_substring_on_target_or_diff() -> None:
    conn = _FakeConnection(
        [
            _row(2, target_iri="urn:weave:workspace:tenant-abc:special-ws"),
            _row(1, target_iri="urn:weave:workspace:tenant-abc:ws-1"),
        ]
    )

    page = await list_entries(
        conn, tenant_id=_TENANT, page=1, per_page=50, filters=AuditFilters(q="special")
    )

    assert [e.seq for e in page.entries] == [2]
    assert page.total == 1
