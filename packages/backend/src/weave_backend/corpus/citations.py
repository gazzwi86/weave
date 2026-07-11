"""CE-V1-TASK-014 AC-003-05: `citations` array on `POST /api/query/nl`
(contracts.md CE-READ-1, additive). Best-effort + fast (implementation
hint): a prov lookup miss or a slow vector search must never blow the NL
p95 budget -- citations are additive, their absence is legal.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from weave_backend.corpus.vectors import VectorMatch

log = logging.getLogger(__name__)

#: AC-003-05: snippet cap.
_SNIPPET_MAX_CHARS = 300


@dataclass(frozen=True)
class Citation:
    entity_iri: str
    artefact_iri: str
    passage_id: str
    locator: str
    snippet: str


def build_citation(*, entity_iri: str, match: VectorMatch) -> Citation:
    text = str(match.meta.get("text", ""))
    return Citation(
        entity_iri=entity_iri,
        artefact_iri=str(match.meta.get("artefact_iri", "")),
        passage_id=match.id,
        locator=str(match.meta.get("locator", "")),
        snippet=text[:_SNIPPET_MAX_CHARS],
    )


async def build_citations_best_effort(
    *,
    lookup_source_artefact: Any,
    search: Any,
    named_graph_iri: str,
    question: str,
    grounded_iris: list[str],
) -> list[Citation]:
    """AC-003-05/-06: for each grounded entity IRI, resolve its source
    artefact via `prov:used` (see `retrieval.lookup_source_artefact`) then
    search that artefact's passages for the closest match to the question.
    An entity with no retained-artefact provenance (e.g. hand-authored)
    yields no citation -- absence is legal, not an error.
    """
    citations = []
    for entity_iri in grounded_iris:
        try:
            artefact_iri = await lookup_source_artefact(named_graph_iri, entity_iri)
            if artefact_iri is None:
                continue
            matches = await search(question, filters={"artefact_iri": artefact_iri}, k=1)
            if matches:
                citations.append(build_citation(entity_iri=entity_iri, match=matches[0]))
        except Exception:  # best-effort: a citation miss must never fail the NL answer
            log.warning("corpus citation lookup failed for %s", entity_iri, exc_info=True)
    return citations
