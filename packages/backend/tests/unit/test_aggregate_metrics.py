"""CE-METRICS-1 (TASK-007) unit tests: pure/mockable pieces only -- no
docker/Oxigraph. `run_query`/`fetch_graph_turtle` are monkeypatched, same
style as `test_instances_duplicates.py`; the seeded-fixture end-to-end path
is covered by the docker-marked integration suite instead.
"""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.ontology.catalogue import Kind
from weave_backend.operations import aggregate_metrics

_NAMED_GRAPH = "urn:weave:tenant:t1:ws:1"


def _kind(iri: str, label: str) -> Kind:
    return Kind(iri=iri, label=label, properties=[])


@pytest.mark.asyncio
async def test_entity_count_by_kind_groups_by_kind_label_from_types_fixture(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-007-02: counts are grouped by the same kind labels
    `GET /api/ontology/types` serves (`catalogue.list_kinds()`) -- never a
    hand-copied kind list. A kind absent from the query result still
    defaults to 0.
    """
    kinds = [
        _kind("https://weave.io/ontology/Process", "Process"),
        _kind("https://weave.io/ontology/Actor", "Actor"),
    ]
    monkeypatch.setattr(aggregate_metrics.catalogue, "list_kinds", lambda: kinds)

    async def _fake_run_query(_query: str, _named_graph_iri: str) -> dict[str, Any]:
        return {
            "results": {
                "bindings": [
                    {
                        "kind": {"value": "https://weave.io/ontology/Process"},
                        "count": {"value": "3"},
                    }
                ]
            }
        }

    monkeypatch.setattr(aggregate_metrics, "run_query", _fake_run_query)

    result = await aggregate_metrics.entity_count_by_kind(_NAMED_GRAPH)

    assert result == {"Process": 3, "Actor": 0}


@pytest.mark.asyncio
async def test_entity_count_by_kind_is_all_zeros_for_empty_graph(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-007-06: an empty tenant graph gets zeros, not a missing key or an
    error.
    """
    kinds = [_kind("https://weave.io/ontology/Process", "Process")]
    monkeypatch.setattr(aggregate_metrics.catalogue, "list_kinds", lambda: kinds)

    async def _fake_run_query(_query: str, _named_graph_iri: str) -> dict[str, Any]:
        return {"results": {"bindings": []}}

    monkeypatch.setattr(aggregate_metrics, "run_query", _fake_run_query)

    result = await aggregate_metrics.entity_count_by_kind(_NAMED_GRAPH)

    assert result == {"Process": 0}


@pytest.mark.asyncio
async def test_draft_published_delta_counts_whole_draft_as_added_when_never_published(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-007-04/Implementation Hints pitfall: `latest_published_iri=None`
    (never-published tenant) diffs the draft against an empty graph, via the
    M1 internal `diff_graphs` core -- not the CE-DIFF-1 endpoint, which
    can't accept a draft side.
    """
    turtle = '<https://weave.io/instances/p1> <https://weave.io/ontology/label> "Invoicing" .'

    async def _fake_fetch(_named_graph_iri: str) -> str:
        return turtle

    monkeypatch.setattr(aggregate_metrics, "fetch_graph_turtle", _fake_fetch)

    result = await aggregate_metrics.draft_published_delta(
        draft_graph_iri=_NAMED_GRAPH, latest_published_iri=None
    )

    assert result.added == 1
    assert result.removed == 0
    assert result.modified == 0


@pytest.mark.asyncio
async def test_resolve_latest_version_returns_none_when_never_published(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-007-01/Implementation Hints pitfall: `latest_version` is `null`
    for a never-published tenant -- `resolve_version`'s `VersionNotFound`
    maps to `None`, not an error.
    """

    async def _raise_not_found(*_args: object, **_kwargs: object) -> str:
        raise aggregate_metrics.versioning.VersionNotFound("latest")

    monkeypatch.setattr(aggregate_metrics.versioning, "resolve_version", _raise_not_found)

    result = await aggregate_metrics.resolve_latest_version(
        conn=None, tenant_id="t1", workspace_id="ws-1"
    )

    assert result is None
