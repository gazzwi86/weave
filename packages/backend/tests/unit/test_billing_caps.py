"""AC-1: budget-cap cascade validation -- a cap write must not exceed its
resolved parent cap. Reuses the same `_FakeConnection` shape as
`test_settings_resolver.py` since `set_cap` calls straight through to
`resolve_setting`/`set_setting` (no new table, no new query surface).
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from weave_backend.billing.caps import BUDGET_CAP_KEY, CapExceedsParent, set_cap

_COMPANY_IRI = "urn:weave:tenant:acme-corp:company"
_WORKSPACE_IRI = "urn:weave:tenant:acme-corp:ws:11111111-1111-1111-1111-111111111111"


class _FakeConnection:
    def __init__(self, rows: dict[tuple[str, str], dict[str, Any]] | None = None) -> None:
        self.rows = rows or {}

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        if "scope_iri = ANY($2)" in query:
            _tenant_id, scope_iris, key = args
            return [
                {"scope_iri": iri, "scope": row["scope"], "value": row["value"]}
                for iri in scope_iris
                if (row := self.rows.get((iri, key))) is not None
            ]
        raise AssertionError(f"unexpected query: {query}")

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
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


async def test_set_cap_rejected_when_exceeds_parent() -> None:
    conn = _FakeConnection(
        {(_COMPANY_IRI, BUDGET_CAP_KEY): {"scope": "company", "rank": 3, "value": "100.0"}}
    )

    with pytest.raises(CapExceedsParent) as exc_info:
        await set_cap(
            conn,
            tenant_id="acme-corp",
            key=BUDGET_CAP_KEY,
            scope_iri=_WORKSPACE_IRI,
            value_usd=200.0,
        )

    assert exc_info.value.parent_cap_usd == 100.0
    assert (_WORKSPACE_IRI, BUDGET_CAP_KEY) not in conn.rows


async def test_set_cap_allowed_within_parent() -> None:
    conn = _FakeConnection(
        {(_COMPANY_IRI, BUDGET_CAP_KEY): {"scope": "company", "rank": 3, "value": "100.0"}}
    )

    await set_cap(
        conn, tenant_id="acme-corp", key=BUDGET_CAP_KEY, scope_iri=_WORKSPACE_IRI, value_usd=50.0
    )

    assert conn.rows[(_WORKSPACE_IRI, BUDGET_CAP_KEY)]["value"] == json.dumps(50.0)


async def test_set_cap_allowed_at_company_scope_with_no_parent() -> None:
    conn = _FakeConnection()

    await set_cap(
        conn, tenant_id="acme-corp", key=BUDGET_CAP_KEY, scope_iri=_COMPANY_IRI, value_usd=500.0
    )

    assert conn.rows[(_COMPANY_IRI, BUDGET_CAP_KEY)]["value"] == json.dumps(500.0)


async def test_set_cap_allowed_when_no_parent_cap_configured_yet() -> None:
    """A workspace cap can be set even if company never configured one --
    there's nothing to exceed."""
    conn = _FakeConnection()

    await set_cap(
        conn, tenant_id="acme-corp", key=BUDGET_CAP_KEY, scope_iri=_WORKSPACE_IRI, value_usd=75.0
    )

    assert conn.rows[(_WORKSPACE_IRI, BUDGET_CAP_KEY)]["value"] == json.dumps(75.0)


async def test_set_cap_allowed_when_exactly_equal_to_parent() -> None:
    """QA edge case: the check is `value_usd > parent.value`, so a child cap
    exactly matching its parent's cap is the boundary and must succeed, not
    raise `CapExceedsParent` -- only strictly exceeding the parent should.
    """
    conn = _FakeConnection(
        {(_COMPANY_IRI, BUDGET_CAP_KEY): {"scope": "company", "rank": 3, "value": "100.0"}}
    )

    await set_cap(
        conn, tenant_id="acme-corp", key=BUDGET_CAP_KEY, scope_iri=_WORKSPACE_IRI, value_usd=100.0
    )

    assert conn.rows[(_WORKSPACE_IRI, BUDGET_CAP_KEY)]["value"] == json.dumps(100.0)
