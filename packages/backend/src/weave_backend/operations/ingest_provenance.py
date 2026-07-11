"""FR-044 / AC-001-01/-02/-05 provenance helpers for the ingest pipeline.

Lives under `operations/`, not `ingest/` -- AC-001-08's structural CI assert
only exempts this package from the "no store-level write import" rule.
`ingest/` calls these two functions and never touches
`rdf.oxigraph_client`/`append_graph`/`load_graph` itself.
"""

from __future__ import annotations

from datetime import UTC, datetime

from rdflib import RDF, Graph, Literal, Namespace, URIRef
from rdflib.namespace import DCTERMS, PROV, XSD

from weave_backend.operations.provenance import prov_graph_iri
from weave_backend.rdf.oxigraph_client import append_graph

#: Same instance-IRI space as `operations.provenance`/`operations.graph_ops`
#: -- artefacts and ingest activities are minted here, not in a draft graph
#: (AC-001-01: artefact is a `prov:Entity` only, no draft-graph individual).
INSTANCES = Namespace("https://weave.io/instances/")
WEAVE = Namespace("https://weave.io/ontology/")

#: FR-044 context fields -> annotation predicate on the ingest `prov:Activity`.
CONTEXT_PREDICATES = {
    "source_system": WEAVE.sourceSystem,
    "owner": WEAVE.owner,
    "date_of_truth": WEAVE.dateOfTruth,
    "sensitivity": WEAVE.sensitivity,
    "context": WEAVE.context,
}


def mint_artefact_iri(artefact_key: str) -> str:
    return str(INSTANCES[f"artefact-{artefact_key}"])


def mint_activity_iri(job_key: str) -> str:
    return str(INSTANCES[f"activity-{job_key}"])


async def write_artefact_entity(
    named_graph_iri: str,
    *,
    artefact_iri: str,
    original_filename: str,
    content_type: str,
    size_bytes: int,
) -> None:
    """AC-001-01: artefact = `prov:Entity` only, no draft-graph individual."""
    entity = URIRef(artefact_iri)
    now = Literal(datetime.now(UTC).isoformat(), datatype=XSD.dateTime)

    graph = Graph()
    graph.add((entity, RDF.type, PROV.Entity))
    graph.add((entity, DCTERMS.title, Literal(original_filename)))
    graph.add((entity, DCTERMS.format, Literal(content_type)))
    graph.add((entity, DCTERMS.extent, Literal(size_bytes)))
    graph.add((entity, PROV.generatedAtTime, now))

    await append_graph(prov_graph_iri(named_graph_iri), graph.serialize(format="turtle"))


async def start_ingest_activity(
    named_graph_iri: str,
    *,
    activity_iri: str,
    extractor_iri: str,
    artefact_iri: str,
    context: dict[str, str],
) -> None:
    """AC-001-02: FR-044 context fields (if given) as annotation properties
    on the ingest `prov:Activity`; system-only provenance when `context` is
    empty. This activity is reused (not re-minted) at accept time -- see
    `operations.provenance.write_activity`'s `activity_iri` param.
    """
    activity = URIRef(activity_iri)
    extractor = URIRef(extractor_iri)
    now = Literal(datetime.now(UTC).isoformat(), datatype=XSD.dateTime)

    graph = Graph()
    graph.add((activity, RDF.type, PROV.Activity))
    graph.add((extractor, RDF.type, PROV.SoftwareAgent))
    graph.add((activity, PROV.wasAssociatedWith, extractor))
    graph.add((activity, PROV.used, URIRef(artefact_iri)))
    graph.add((activity, PROV.startedAtTime, now))
    for key, value in context.items():
        predicate = CONTEXT_PREDICATES.get(key)
        if predicate is not None and value:
            graph.add((activity, predicate, Literal(value)))

    await append_graph(prov_graph_iri(named_graph_iri), graph.serialize(format="turtle"))
