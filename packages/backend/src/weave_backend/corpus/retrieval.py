"""CE-V1-TASK-014 AC-003-02/-05/-06: retrieval-side corpus search + the
prov:used walk that resolves a grounded entity IRI back to its source
artefact (same activity that `prov:generated` the entity also `prov:used`
the artefact -- see `operations/provenance.py::write_activity`).
"""

from __future__ import annotations

from collections.abc import Callable

from weave_backend.corpus.vectors import VectorIndex, VectorMatch
from weave_backend.rdf.oxigraph_client import run_query

Embed = Callable[[str, list[str]], list[list[float]]]

_LOOKUP_SOURCE_ARTEFACT_QUERY = """
PREFIX prov: <http://www.w3.org/ns/prov#>
SELECT ?artefact WHERE {{
  ?activity prov:generated <{entity_iri}> ;
            prov:used ?artefact .
}}
LIMIT 1
"""


def search(  # noqa: PLR0913 -- Law E waiver: every param is an independently
    # injected collaborator (index/embed) or a distinct query dimension
    # (tenant/model/question/k), no natural config-object grouping.
    *,
    index: VectorIndex,
    embed: Embed,
    tenant_id: str,
    model_id: str,
    question: str,
    k: int,
) -> list[VectorMatch]:
    """Embeds `question` with the tenant's index model and returns the
    top-`k` ranked passage matches. Callers decide what to do on empty
    results (citations are additive/best-effort, never a hard failure).
    """
    [vector] = embed(model_id, [question])
    return index.query(tenant_id, vector, k=k)


async def lookup_source_artefact(named_graph_iri: str, *, entity_iri: str) -> str | None:
    """AC-003-06: resolve a SPARQL-grounded entity IRI back to the artefact
    it was extracted from, via the shared prov:Activity. Returns `None` when
    unresolvable (entity wasn't extraction-sourced) -- best-effort caller.
    """
    prov_graph_iri = f"{named_graph_iri}:prov"
    query = _LOOKUP_SOURCE_ARTEFACT_QUERY.format(entity_iri=entity_iri)
    results = await run_query(query, prov_graph_iri)
    bindings = results.get("results", {}).get("bindings", [])
    if not bindings:
        return None
    value = bindings[0]["artefact"]["value"]
    return str(value)
