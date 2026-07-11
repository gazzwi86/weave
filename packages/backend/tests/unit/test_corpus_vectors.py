"""CE-V1-TASK-014 AC-003-02/-03/-04/-08: the in-memory S3-Vectors stand-in
(implementation hint: no local S3 Vectors emulator exists, so a thin fake
behind a small put/query/delete interface stands in -- Law F).
"""

from __future__ import annotations

import pytest

from weave_backend.corpus.vectors import ModelMismatch, VectorIndex


def test_should_assert_index_model_before_embedding_and_raise_on_mismatch() -> None:
    index = VectorIndex()
    index.ensure_index("tenant-a", model_id="titan-v2", dims=4)

    with pytest.raises(ModelMismatch):
        index.ensure_index("tenant-a", model_id="cohere-v3", dims=4)


def test_should_put_and_query_top_k_by_cosine_similarity() -> None:
    index = VectorIndex()
    index.ensure_index("tenant-a", model_id="titan-v2", dims=2)
    index.put("tenant-a", "p1", [1.0, 0.0], meta={"artefact_iri": "a1"})
    index.put("tenant-a", "p2", [0.0, 1.0], meta={"artefact_iri": "a2"})

    results = index.query("tenant-a", [1.0, 0.0], k=1)

    assert len(results) == 1
    assert results[0].id == "p1"


def test_tenant_a_search_should_never_return_tenant_b_passages() -> None:
    """Release-gating cross-tenant vector-isolation test (ADR-001 rank),
    unit-level companion to the docker-integration two-tenant fixture.
    """
    index = VectorIndex()
    index.ensure_index("tenant-a", model_id="titan-v2", dims=2)
    index.ensure_index("tenant-b", model_id="titan-v2", dims=2)
    index.put("tenant-b", "secret", [1.0, 0.0], meta={"artefact_iri": "b1"})

    results = index.query("tenant-a", [1.0, 0.0], k=10)

    assert results == []


def test_should_replace_passage_on_re_ingest_not_duplicate() -> None:
    index = VectorIndex()
    index.ensure_index("tenant-a", model_id="titan-v2", dims=2)
    index.put("tenant-a", "p1", [1.0, 0.0], meta={"artefact_iri": "a1", "v": 1})
    index.put("tenant-a", "p1", [1.0, 0.0], meta={"artefact_iri": "a1", "v": 2})

    results = index.query("tenant-a", [1.0, 0.0], k=10)

    assert len(results) == 1
    assert results[0].meta["v"] == 2


def test_delete_by_artefact_removes_only_that_artefacts_passages() -> None:
    index = VectorIndex()
    index.ensure_index("tenant-a", model_id="titan-v2", dims=2)
    index.put("tenant-a", "p1", [1.0, 0.0], meta={"artefact_iri": "a1"})
    index.put("tenant-a", "p2", [0.0, 1.0], meta={"artefact_iri": "a2"})

    index.delete_by_artefact("tenant-a", "a1")

    results = index.query("tenant-a", [1.0, 0.0], k=10)
    assert [r.id for r in results] == ["p2"]


def test_delete_tenant_removes_all_that_tenants_vectors() -> None:
    """AC-003-08: tenant deletion rides the ADR-001 deletion path."""
    index = VectorIndex()
    index.ensure_index("tenant-a", model_id="titan-v2", dims=2)
    index.put("tenant-a", "p1", [1.0, 0.0], meta={"artefact_iri": "a1"})

    index.delete_tenant("tenant-a")

    assert index.query("tenant-a", [1.0, 0.0], k=10) == []
