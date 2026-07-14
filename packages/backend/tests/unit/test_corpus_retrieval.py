"""CE-V1-TASK-014 AC-003-02/-05/-06: retrieval-side corpus search + the
prov:used walk that resolves an entity IRI back to its source artefact.
"""

from __future__ import annotations

import pytest

from weave_backend.corpus import retrieval as retrieval_mod
from weave_backend.corpus.retrieval import lookup_source_artefact, search
from weave_backend.corpus.vectors import VectorIndex


def test_search_embeds_the_query_and_returns_ranked_matches() -> None:
    index = VectorIndex()
    index.ensure_index("tenant-a", model_id="m", dims=2)
    index.put("tenant-a", "p1", [1.0, 0.0], meta={"text": "close"})
    index.put("tenant-a", "p2", [0.0, 1.0], meta={"text": "far"})

    def embed(model_id: str, texts: list[str]) -> list[list[float]]:
        del model_id
        assert texts == ["find close"]
        return [[1.0, 0.0]]

    results = search(
        index=index,
        embed=embed,
        tenant_id="tenant-a",
        model_id="m",
        question="find close",
        k=1,
    )

    assert results[0].id == "p1"


async def test_lookup_source_artefact_walks_prov_used_from_prov_generated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_run_query(query: str, named_graph_iri: str) -> dict[str, object]:
        assert named_graph_iri == "https://weave.io/graphs/ws-1:prov"
        assert "urn:weave:instances:entity-1" in query
        return {
            "results": {
                "bindings": [{"artefact": {"value": "urn:weave:instances:artefact-1"}}]
            }
        }

    monkeypatch.setattr(retrieval_mod, "run_query", fake_run_query)

    artefact_iri = await lookup_source_artefact(
        "https://weave.io/graphs/ws-1", entity_iri="urn:weave:instances:entity-1"
    )

    assert artefact_iri == "urn:weave:instances:artefact-1"


async def test_lookup_source_artefact_returns_none_when_unresolved(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_run_query(query: str, named_graph_iri: str) -> dict[str, object]:
        del query, named_graph_iri
        return {"results": {"bindings": []}}

    monkeypatch.setattr(retrieval_mod, "run_query", fake_run_query)

    artefact_iri = await lookup_source_artefact(
        "https://weave.io/graphs/ws-1", entity_iri="urn:weave:instances:entity-1"
    )

    assert artefact_iri is None
