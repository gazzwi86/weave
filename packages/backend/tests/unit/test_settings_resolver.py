"""AC-4/AC-5: cascade resolution (tightest wins) and the looser-override
write guard, against a stub asyncpg connection (no real Postgres -- the
resolver's only DB interaction is `fetchrow`/`execute`, both fakeable).
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from weave_backend.settings.resolver import (
    LooserOverrideRejected,
    SettingNotFound,
    resolve_setting,
    set_setting,
)

_COMPANY_IRI = "urn:weave:tenant:acme-corp:company"
_WORKSPACE_IRI = "urn:weave:tenant:acme-corp:ws:11111111-1111-1111-1111-111111111111"


class _FakeConnection:
    """In-memory stand-in keyed by (scope_iri, key), matching the real
    table's `UNIQUE (scope_iri, key)` constraint.
    """

    def __init__(self, rows: dict[tuple[str, str], dict[str, Any]] | None = None) -> None:
        self.rows = rows or {}

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        if "scope_iri = $2" in query:
            _tenant_id, scope_iri, key = args
            row = self.rows.get((scope_iri, key))
            return {"scope": row["scope"], "value": row["value"]} if row else None
        if "scope_rank < $3" in query:
            _tenant_id, key, rank = args
            tighter = [r for (_iri, k), r in self.rows.items() if k == key and r["rank"] < rank]
            if not tighter:
                return None
            winner = min(tighter, key=lambda r: r["rank"])
            return {"scope": winner["scope"]}
        raise AssertionError(f"unexpected query: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        _tenant_id, scope, rank, scope_iri, key, value = args
        self.rows[(scope_iri, key)] = {
            "scope": scope,
            "rank": rank,
            "value": json.dumps(json.loads(value)),
        }
        return "INSERT 0 1"


async def test_settings_cascade_tighter_wins() -> None:
    conn = _FakeConnection(
        {
            (_COMPANY_IRI, "theme"): {"scope": "company", "value": '"dark"'},
            (_WORKSPACE_IRI, "theme"): {"scope": "workspace", "value": '"light"'},
        }
    )

    resolved = await resolve_setting(
        conn,
        tenant_id="acme-corp",
        key="theme",
        context_iri=_WORKSPACE_IRI,
    )

    assert resolved.value == "light"
    assert resolved.resolved_from_iri == _WORKSPACE_IRI


async def test_settings_cascade_falls_back_to_company_when_no_workspace_value() -> None:
    conn = _FakeConnection({(_COMPANY_IRI, "theme"): {"scope": "company", "value": '"dark"'}})

    resolved = await resolve_setting(
        conn,
        tenant_id="acme-corp",
        key="theme",
        context_iri=_WORKSPACE_IRI,
    )

    assert resolved.value == "dark"
    assert resolved.resolved_from_iri == _COMPANY_IRI


async def test_settings_cascade_raises_when_nothing_set() -> None:
    conn = _FakeConnection()

    with pytest.raises(SettingNotFound):
        await resolve_setting(
            conn,
            tenant_id="acme-corp",
            key="theme",
            context_iri=_WORKSPACE_IRI,
        )


async def test_settings_looser_override_rejected() -> None:
    conn = _FakeConnection(
        {(_WORKSPACE_IRI, "theme"): {"scope": "workspace", "rank": 1, "value": '"light"'}}
    )

    with pytest.raises(LooserOverrideRejected) as exc_info:
        await set_setting(
            conn,
            tenant_id="acme-corp",
            key="theme",
            scope_iri=_COMPANY_IRI,
            value="dark",
        )

    assert exc_info.value.tighter_scope == "workspace"


async def test_settings_company_write_allowed_when_no_tighter_override_exists() -> None:
    conn = _FakeConnection()

    await set_setting(
        conn,
        tenant_id="acme-corp",
        key="theme",
        scope_iri=_COMPANY_IRI,
        value="dark",
    )

    assert conn.rows[(_COMPANY_IRI, "theme")]["value"] == json.dumps("dark")
