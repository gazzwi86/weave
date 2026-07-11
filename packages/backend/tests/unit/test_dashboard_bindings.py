"""PLAT-V1-TASK-016 unit tests: the declarative CATEGORIES registry
(AC-1), threshold resolution via PLAT-SETTINGS-1 (AC-5), the growth
advisory suppression rule (AC-8), and the S11 agent-only feed filter.
"""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock

import pytest

from weave_backend.dashboard import bindings, snapshots
from weave_backend.dashboard.thresholds import DEFAULTS, threshold
from weave_backend.identity.registry import agent_principal_iri, human_principal_iri
from weave_backend.settings.resolver import SettingNotFound


def test_bindings_cite_published_contracts_only() -> None:
    """AC-1: every CATEGORIES entry declares only published contract IDs
    (plus S10's internal CloudWatch namespace, which is not a contract and
    is never listed in `contracts`), and at least one component-compatible
    shape.
    """
    for name, binding in bindings.CATEGORIES.items():
        # S10 (operational-health) legitimately cites zero contracts -- its
        # source is the internal CloudWatch ops-metrics namespace, not a
        # published contract (AC-1).
        if name != "operational-health":
            assert binding.contracts, f"{name} declares no contracts"
        for contract_id in binding.contracts:
            assert contract_id in bindings.PUBLISHED_CONTRACTS, (
                f"{name} cites uncontracted source {contract_id!r}"
            )
        assert binding.shapes, f"{name} declares no shapes"


def test_ten_categories_present() -> None:
    assert len(bindings.CATEGORIES) == 10


async def test_thresholds_resolve_via_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = AsyncMock()
    resolved = AsyncMock()
    resolved.value = "5"
    conn.fetch = AsyncMock(return_value=[])

    async def _resolve(*args: object, **kwargs: object) -> object:
        return resolved

    monkeypatch.setattr("weave_backend.dashboard.thresholds.resolve_setting", _resolve)
    value = await threshold(
        conn,
        tenant_id="t1",
        context_iri="urn:weave:tenant:t1",
        key="dashboard.ops.spike_factor",
    )
    assert value == 5.0


async def test_threshold_falls_back_to_default_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = AsyncMock()

    async def _raise(*args: object, **kwargs: object) -> object:
        raise SettingNotFound("dashboard.ops.spike_factor")

    monkeypatch.setattr("weave_backend.dashboard.thresholds.resolve_setting", _raise)
    value = await threshold(
        conn,
        tenant_id="t1",
        context_iri="urn:weave:tenant:t1",
        key="dashboard.ops.spike_factor",
    )
    assert value == DEFAULTS["dashboard.ops.spike_factor"]


def test_growth_advisory_suppressed_when_young() -> None:
    samples = [
        snapshots.GrowthSample(day=date(2026, 7, 1) , entity_count=10) for _ in range(13)
    ]
    assert snapshots.stagnation_advisory(samples, stagnation_days=14) is False


def test_growth_advisory_fires_when_flat_and_enough_samples() -> None:
    samples = [snapshots.GrowthSample(day=date(2026, 7, 1), entity_count=10) for _ in range(14)]
    assert snapshots.stagnation_advisory(samples, stagnation_days=14) is True


def test_s11_filters_agent_principals_only() -> None:
    human = human_principal_iri("u-1")
    agent = agent_principal_iri("arn:aws:iam::1:role/x")
    rows = [
        {"actor_principal_iri": human, "event_type": "ce.version.published"},
        {"actor_principal_iri": agent, "event_type": "ce.entity.created"},
    ]
    filtered = bindings.filter_agent_rows(rows)
    assert len(filtered) == 1
    assert filtered[0]["actor_principal_iri"] == agent
