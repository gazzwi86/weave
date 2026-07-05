"""AC-005-04: `find_duplicate_iri` is a thin async wrapper around
`graph_ops.find_existing_by_label_kind` -- `fetch_graph_turtle` is
monkeypatched so this stays a fast unit test (no docker/oxigraph needed);
real end-to-end behaviour against a live graph is covered by
`tests/integration/test_instances.py`.
"""

from __future__ import annotations

import pytest

from weave_backend.instances import duplicates

_TURTLE = """
@prefix weave: <https://weave.io/ontology/> .
@prefix inst: <https://weave.io/instances/> .

inst:actor-1 a weave:Actor ;
    weave:label "Jess" .
"""


@pytest.mark.asyncio
async def test_find_duplicate_iri_returns_existing_iri_on_case_insensitive_match(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_fetch(_named_graph_iri: str) -> str:
        return _TURTLE

    monkeypatch.setattr(duplicates, "fetch_graph_turtle", _fake_fetch)

    result = await duplicates.find_duplicate_iri("urn:weave:tenant:t:ws:1", "Actor", "jess")

    assert result == "https://weave.io/instances/actor-1"


@pytest.mark.asyncio
async def test_find_duplicate_iri_returns_none_when_no_match(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_fetch(_named_graph_iri: str) -> str:
        return _TURTLE

    monkeypatch.setattr(duplicates, "fetch_graph_turtle", _fake_fetch)

    result = await duplicates.find_duplicate_iri("urn:weave:tenant:t:ws:1", "Actor", "Nobody")

    assert result is None


@pytest.mark.asyncio
async def test_find_duplicate_iri_handles_an_empty_graph(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_fetch(_named_graph_iri: str) -> str:
        return ""

    monkeypatch.setattr(duplicates, "fetch_graph_turtle", _fake_fetch)

    result = await duplicates.find_duplicate_iri("urn:weave:tenant:t:ws:1", "Actor", "Jess")

    assert result is None
