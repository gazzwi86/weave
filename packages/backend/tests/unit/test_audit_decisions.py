"""TASK-020 (build-engine EPIC-007): `audit/decisions.py` -- the Decision
Log's read view over PLAT-AUDIT-1. Fakes only `conn.fetch` (same style as
`test_audit_listing.py`); no real Postgres needed for these.
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from weave_backend.audit.decisions import (
    AuditUnavailable,
    DecisionQuery,
    classify_kind,
    list_decisions,
)

_TENANT = "t1"
_PROJECT = "urn:weave:project:t1:acme-corp"
_OTHER_PROJECT = "urn:weave:project:t1:other"


def _query(**overrides: Any) -> DecisionQuery:
    defaults: dict[str, Any] = {
        "tenant_id": _TENANT,
        "project_iri": _PROJECT,
        "kind": "all",
        "search": None,
        "cursor": None,
    }
    defaults.update(overrides)
    return DecisionQuery(**defaults)


def _row(
    seq: int,
    event_type: str = "gate_result_dor",
    target_iri: str = _PROJECT,
    diff_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "seq": seq,
        "ts": f"2026-07-08T00:00:{seq:02d}+00:00",
        "actor_principal_iri": "urn:weave:principal:t1:human:alice",
        "event_type": event_type,
        "target_iri": target_iri,
        "diff_summary": json.dumps(diff_summary) if diff_summary is not None else None,
    }


class _FakeConnection:
    """Mirrors the real query's semantics in Python so tests assert on
    `list_decisions`' own cursor/kind/search logic, not raw SQL text --
    same shape as `test_audit_listing.py`'s `_FakeConnection`.
    """

    def __init__(self, rows: list[dict[str, Any]], *, raise_on_fetch: Exception | None = None):
        self.rows = rows
        self.raise_on_fetch = raise_on_fetch
        self.last_args: tuple[Any, ...] | None = None

    async def fetch(self, _query: str, *args: Any) -> list[dict[str, Any]]:
        self.last_args = args
        if self.raise_on_fetch is not None:
            raise self.raise_on_fetch
        _tenant_id, target_iri, cursor, search, patterns, exclude, limit = args
        rows = [r for r in self.rows if r["target_iri"] == target_iri]
        if cursor is not None:
            rows = [r for r in rows if r["seq"] < cursor]
        if search:
            rows = [
                r
                for r in rows
                if search.lower() in r["event_type"].lower()
                or (r["diff_summary"] and search.lower() in r["diff_summary"].lower())
            ]
        if patterns:
            from fnmatch import fnmatch

            def matches(event_type: str) -> bool:
                hit = any(fnmatch(event_type, p.replace("%", "*")) for p in patterns)
                return not hit if exclude else hit

            rows = [r for r in rows if matches(r["event_type"])]
        rows = sorted(rows, key=lambda r: -r["seq"])
        return rows[:limit]


async def test_classify_kind_decision_for_gate_and_hitl_events() -> None:
    assert classify_kind("gate_result_dor") == "decision"
    assert classify_kind("gate_result_brand") == "decision"
    assert classify_kind("hitl_response") == "decision"
    assert classify_kind("ceremony_approved") == "decision"


async def test_classify_kind_task_update_for_write_back_and_scaffold_events() -> None:
    assert classify_kind("write_back_success") == "task_update"
    assert classify_kind("write_back_fail_shacl") == "task_update"
    assert classify_kind("repo_bootstrapped") == "task_update"


async def test_classify_kind_system_is_the_complement() -> None:
    assert classify_kind("authz_denied") == "system"
    assert classify_kind("project.pin.upgraded") == "system"
    assert classify_kind("build.source_control.configured") == "system"


# QA edge case (TASK-020 AC-7): an empty/near-miss event_type must never
# raise (fnmatch on "" is valid) and must fall to the "system" complement
# rather than false-matching a prefix pattern by accident.
async def test_classify_kind_empty_and_near_miss_event_types_are_system() -> None:
    assert classify_kind("") == "system"
    # "gate_result" (no trailing "_") must NOT satisfy the "gate_result_*"
    # prefix pattern -- a bare name is not a "gate_result_<kind>" event.
    assert classify_kind("gate_result") == "system"


async def test_list_decisions_scopes_to_project_target_iri() -> None:
    conn = _FakeConnection([_row(3), _row(2, target_iri=_OTHER_PROJECT), _row(1)])

    page = await list_decisions(conn, _query())

    assert [e.seq for e in page.entries] == [3, 1]


async def test_list_decisions_default_kind_decision_excludes_task_update_rows() -> None:
    conn = _FakeConnection(
        [_row(2, event_type="write_back_success"), _row(1, event_type="gate_result_dor")]
    )

    page = await list_decisions(conn, _query(kind="decision"))

    assert [e.seq for e in page.entries] == [1]
    assert page.entries[0].kind == "decision"


async def test_list_decisions_kind_system_is_logical_complement() -> None:
    conn = _FakeConnection(
        [
            _row(3, event_type="authz_denied"),
            _row(2, event_type="write_back_success"),
            _row(1, event_type="gate_result_dor"),
        ]
    )

    page = await list_decisions(conn, _query(kind="system"))

    assert [e.seq for e in page.entries] == [3]
    assert page.entries[0].kind == "system"


async def test_list_decisions_searches_event_type_and_diff_summary() -> None:
    conn = _FakeConnection(
        [
            _row(2, event_type="gate_result_dor", diff_summary={"note": "brand check"}),
            _row(1, event_type="hitl_response", diff_summary={"note": "unrelated"}),
        ]
    )

    page = await list_decisions(conn, _query(search="brand"))

    assert [e.seq for e in page.entries] == [2]


async def test_list_decisions_paginates_with_cursor_and_returns_next_cursor() -> None:
    conn = _FakeConnection([_row(3), _row(2), _row(1)])

    first = await list_decisions(conn, _query(limit=2))
    assert [e.seq for e in first.entries] == [3, 2]
    assert first.next_cursor == 2

    second = await list_decisions(conn, _query(cursor=first.next_cursor, limit=2))
    assert [e.seq for e in second.entries] == [1]
    assert second.next_cursor is None


async def test_list_decisions_raises_audit_unavailable_on_connection_error() -> None:
    conn = _FakeConnection([], raise_on_fetch=OSError("connection refused"))

    with pytest.raises(AuditUnavailable):
        await list_decisions(conn, _query())
