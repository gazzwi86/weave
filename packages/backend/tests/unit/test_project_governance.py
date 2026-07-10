"""TASK-014 unit tests: AC-2/AC-3/AC-4 -- the create-time governance-cascade
resolution and the PATCH-time cap/model-tier validation, against a stub
asyncpg connection (mirrors `test_settings_resolver.py`'s `_FakeConnection`,
no real Postgres needed -- `resolve_setting`'s only DB call is `fetch`).

ADR-013: a Build project IRI never parses under `settings/scope.py`'s
cascade grammar, so every cascade attempt here raises `InvalidScopeIri` and
falls back to company scope -- these tests exercise that fallback, not a
literal domain/project override (which is unreachable in production today).
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from weave_backend.build.costs import BUDGET_CAP_KEY
from weave_backend.projects.governance import (
    DEFAULT_MODEL_TIER,
    MODEL_TIER_KEY,
    CapLooserThanParent,
    InvalidModelTier,
    resolve_governance,
    validate_cap_against_parent,
    validate_model_tier,
)

_TENANT = "acme-corp"
_COMPANY_IRI = f"urn:weave:tenant:{_TENANT}:company"
_PROJECT_IRI = f"urn:weave:project:{_TENANT}:widget-factory"


class _FakeConnection:
    """Keyed by (scope_iri, key) -- same shape as
    `test_settings_resolver.py`'s fake, minus the write path (this module
    never calls `set_setting`).
    """

    def __init__(self, rows: dict[tuple[str, str], dict[str, Any]] | None = None) -> None:
        self.rows = rows or {}

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        assert "scope_iri = ANY($2)" in query
        _tenant_id, scope_iris, key = args
        return [
            {"scope_iri": iri, "scope": row["scope"], "value": row["value"]}
            for iri in scope_iris
            if (row := self.rows.get((iri, key))) is not None
        ]


def _seeded(key: str, value: Any) -> _FakeConnection:
    return _FakeConnection({(_COMPANY_IRI, key): {"scope": "company", "value": json.dumps(value)}})


async def test_resolve_governance_defaults_when_nothing_configured() -> None:
    conn = _FakeConnection()

    snapshot = await resolve_governance(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert snapshot.model_tier == DEFAULT_MODEL_TIER
    assert snapshot.model_tier_source == "default"
    assert snapshot.cap_usd is None
    assert snapshot.cap_source is None


async def test_resolve_governance_falls_back_to_company_scope() -> None:
    conn = _FakeConnection(
        {
            (_COMPANY_IRI, MODEL_TIER_KEY): {"scope": "company", "value": json.dumps("premium")},
            (_COMPANY_IRI, BUDGET_CAP_KEY): {"scope": "company", "value": json.dumps(500.0)},
        }
    )

    snapshot = await resolve_governance(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert snapshot.model_tier == "premium"
    assert snapshot.model_tier_source == "company"
    assert snapshot.cap_usd == 500.0
    assert snapshot.cap_source == "company"


async def test_validate_cap_against_parent_passes_when_no_parent_configured() -> None:
    conn = _FakeConnection()

    await validate_cap_against_parent(conn, tenant_id=_TENANT, value_usd=1000.0)


async def test_validate_cap_against_parent_passes_when_tighter_than_parent() -> None:
    conn = _seeded(BUDGET_CAP_KEY, 500.0)

    await validate_cap_against_parent(conn, tenant_id=_TENANT, value_usd=100.0)


async def test_validate_cap_against_parent_rejects_looser_than_parent() -> None:
    conn = _seeded(BUDGET_CAP_KEY, 500.0)

    with pytest.raises(CapLooserThanParent) as exc_info:
        await validate_cap_against_parent(conn, tenant_id=_TENANT, value_usd=501.0)

    assert exc_info.value.parent_cap_usd == 500.0
    assert exc_info.value.level == "company"


@pytest.mark.parametrize("tier", ["standard", "fast", "premium", "experimental"])
def test_validate_model_tier_accepts_defined_tiers(tier: str) -> None:
    validate_model_tier(tier)


def test_validate_model_tier_rejects_unknown_tier() -> None:
    with pytest.raises(InvalidModelTier):
        validate_model_tier("bespoke")
