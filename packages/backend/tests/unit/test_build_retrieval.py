"""TASK-003 (ADR-005, EPIC-011) unit tests: deterministic seed + weighted
k-hop BPMO retrieval under the 200-node cap.

`_fixture_neighbours` is a fake `neighbours_fn` (paginated `CE-READ-1` reads
are the orchestrator-internal integration's concern, not this pure
scorer's -- Law F: stub the boundary, test the logic). `_FakeSettingsConnection`
mirrors `test_build_cost.py`'s fake (duplicated per-file precedent, not a
shared test fake across modules).
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

import pytest

from weave_backend.build.retrieval import (
    RETRIEVAL_SETTINGS_KEY,
    RetrievalConfig,
    SeedSetExceedsCapError,
    predicate_class,
    resolve_retrieval_config,
    retrieve_slice,
)
from weave_backend.settings.resolver import set_setting

_TENANT = "tenant-retrieval"
_COMPANY_IRI = f"urn:weave:tenant:{_TENANT}:company"
_PROJECT_IRI = f"urn:weave:tenant:{_TENANT}:ws:11111111-1111-1111-1111-111111111111:project:acme"

_STRUCTURAL = "urn:weave:bpmo:partOf"
_UNKNOWN_PREDICATE = "urn:weave:bpmo:someMadeUpEdge"

_DEFAULT_CFG = RetrievalConfig(
    weights={"structural": 1.0, "associative": 0.5, "annotation": 0.1}, max_hops=2
)


class _FakeSettingsConnection:
    """In-memory stand-in settings cascade -- mirrors `test_build_cost.py`'s
    `_FakeSettingsConnection` (duplicated per-file precedent).
    """

    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], dict[str, Any]] = {}

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
            return None
        raise AssertionError(f"unexpected query: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        _tenant_id, scope, _rank, scope_iri, key, value = args
        self.rows[(scope_iri, key)] = {"scope": scope, "value": json.dumps(json.loads(value))}
        return "INSERT 0 1"


def _make_edge_fixture(seed: str, fan_count: int) -> dict[str, list[tuple[str, str, str]]]:
    """One seed, `fan_count` directly-reachable structural neighbours --
    enough candidates (seed + fan_count) to exceed the 200-node cap.
    """
    return {seed: [(seed, _STRUCTURAL, f"urn:n{i:04d}") for i in range(fan_count)]}


def _fixture_neighbours_fn(
    edges_by_src: dict[str, list[tuple[str, str, str]]],
) -> Callable[[list[str]], Awaitable[list[tuple[str, str, str]]]]:
    async def _neighbours(frontier: list[str]) -> list[tuple[str, str, str]]:
        out: list[tuple[str, str, str]] = []
        for src in frontier:
            out.extend(edges_by_src.get(src, []))
        return out

    return _neighbours


@pytest.mark.asyncio
async def test_should_select_same_200_nodes_for_same_graph_and_seeds() -> None:
    seed = "urn:s0"
    edges = _make_edge_fixture(seed, fan_count=299)  # 300 nodes total incl. seed
    neighbours_fn = _fixture_neighbours_fn(edges)

    first = await retrieve_slice(seed_iris=[seed], neighbours_fn=neighbours_fn, cfg=_DEFAULT_CFG)
    second = await retrieve_slice(seed_iris=[seed], neighbours_fn=neighbours_fn, cfg=_DEFAULT_CFG)

    assert first.nodes == second.nodes
    assert len(first.nodes) == 200
    assert first.truncated is True
    assert first.dropped_count == 100


@pytest.mark.asyncio
async def test_should_always_retain_seed_nodes() -> None:
    seeds = ["urn:s0", "urn:s1"]
    edges = {
        "urn:s0": [("urn:s0", _STRUCTURAL, f"urn:n{i:04d}") for i in range(250)],
        "urn:s1": [],
    }
    neighbours_fn = _fixture_neighbours_fn(edges)

    result = await retrieve_slice(seed_iris=seeds, neighbours_fn=neighbours_fn, cfg=_DEFAULT_CFG)

    assert set(seeds).issubset(set(result.nodes))
    assert len(result.nodes) == 200


@pytest.mark.asyncio
async def test_should_score_node_by_max_over_multiple_paths() -> None:
    # dst reachable at hop 1 (weight 1.0 -> 0.5) and would-be hop 2 via a
    # second seed (weight 1.0 -> 0.333) -- max over paths keeps the hop-1
    # score, never overwritten by the lower hop-2 score computed later.
    edges = {
        "urn:s0": [("urn:s0", _STRUCTURAL, "urn:shared")],
        "urn:s1": [("urn:s1", _STRUCTURAL, "urn:mid")],
        "urn:mid": [("urn:mid", _STRUCTURAL, "urn:shared")],
    }
    neighbours_fn = _fixture_neighbours_fn(edges)

    result = await retrieve_slice(
        seed_iris=["urn:s0", "urn:s1"], neighbours_fn=neighbours_fn, cfg=_DEFAULT_CFG
    )

    assert "urn:shared" in result.nodes
    assert result.scores["urn:shared"] == pytest.approx(0.5)


async def test_should_error_loudly_when_seed_set_alone_exceeds_cap() -> None:
    seeds = [f"urn:seed{i:04d}" for i in range(201)]

    with pytest.raises(SeedSetExceedsCapError):
        await retrieve_slice(
            seed_iris=seeds, neighbours_fn=_fixture_neighbours_fn({}), cfg=_DEFAULT_CFG
        )


@pytest.mark.asyncio
async def test_should_resolve_weights_and_max_hops_from_settings() -> None:
    conn = _FakeSettingsConnection()
    await set_setting(
        conn,
        tenant_id=_TENANT,
        key=RETRIEVAL_SETTINGS_KEY,
        scope_iri=_COMPANY_IRI,
        value={
            "weights": {"structural": 2.0, "associative": 0.4, "annotation": 0.05},
            "max_hops": 3,
        },
    )

    cfg = await resolve_retrieval_config(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert cfg.max_hops == 3
    assert cfg.weights["structural"] == 2.0


@pytest.mark.asyncio
async def test_resolve_retrieval_config_defaults_when_unconfigured() -> None:
    conn = _FakeSettingsConnection()

    cfg = await resolve_retrieval_config(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert cfg.max_hops == 2
    assert cfg.weights == {"structural": 1.0, "associative": 0.5, "annotation": 0.1}


def test_predicate_class_structural_known() -> None:
    assert predicate_class(_STRUCTURAL) == "structural"


def test_predicate_class_unknown_falls_back_to_annotation_and_logs_once(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.WARNING):
        first = predicate_class(_UNKNOWN_PREDICATE)
        second = predicate_class(_UNKNOWN_PREDICATE)

    assert first == "annotation"
    assert second == "annotation"
    unknown_warnings = [r for r in caplog.records if "unknown_predicate" in r.message]
    assert len(unknown_warnings) == 1
