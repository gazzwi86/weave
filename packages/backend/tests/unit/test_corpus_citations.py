"""CE-V1-TASK-014 AC-003-05: `citations` array pairing entity IRI +
artefact IRI + passage id + locator + <=300-char snippet
(`citation-pairs-iri-and-passage`, named test).
"""

from __future__ import annotations

from weave_backend.corpus.citations import build_citation
from weave_backend.corpus.vectors import VectorMatch


def test_citation_pairs_iri_and_passage() -> None:
    meta: dict[str, object] = {
        "artefact_iri": "urn:weave:instances:artefact-1",
        "locator": "Intro#0",
        "text": "x" * 50,
    }
    match = VectorMatch(id="p1", score=0.9, meta=meta)

    citation = build_citation(entity_iri="urn:weave:instances:e1", match=match)

    assert citation.entity_iri == "urn:weave:instances:e1"
    assert citation.artefact_iri == "urn:weave:instances:artefact-1"
    assert citation.passage_id == "p1"
    assert citation.locator == "Intro#0"
    assert len(citation.snippet) <= 300


def test_snippet_is_truncated_to_300_chars() -> None:
    meta: dict[str, object] = {"artefact_iri": "a1", "locator": "loc", "text": "y" * 5000}
    match = VectorMatch(id="p1", score=0.9, meta=meta)

    citation = build_citation(entity_iri="e1", match=match)

    assert len(citation.snippet) == 300
