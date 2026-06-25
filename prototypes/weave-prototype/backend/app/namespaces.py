"""Namespaces, the Weave vocabulary, and node-kind / relationship registries.

Weave leans on well-known open vocabularies (RDF, RDFS, OWL, SKOS, PROV,
Dublin Core Terms) and adds a small `weave:` namespace for the few things
those don't cover (business domains/capabilities, data assets, canvas colour
and layout hints).
"""

from __future__ import annotations

# --- Namespace IRIs ---------------------------------------------------------

RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
OWL = "http://www.w3.org/2002/07/owl#"
SKOS = "http://www.w3.org/2004/02/skos/core#"
PROV = "http://www.w3.org/ns/prov#"
DCTERMS = "http://purl.org/dc/terms/"
XSD = "http://www.w3.org/2001/XMLSchema#"
WEAVE = "https://weave.dev/ontology#"

# IRI prefix for instance data created in the app.
RESOURCE = "https://weave.dev/resource/"


def local_name(iri: str) -> str:
    """Human-readable local part of an IRI (after '#', else after the last '/')."""
    return iri.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


PREFIXES: dict[str, str] = {
    "rdf": RDF,
    "rdfs": RDFS,
    "owl": OWL,
    "skos": SKOS,
    "prov": PROV,
    "dcterms": DCTERMS,
    "xsd": XSD,
    "weave": WEAVE,
    "res": RESOURCE,
}

SPARQL_PREFIXES = "\n".join(f"PREFIX {p}: <{iri}>" for p, iri in PREFIXES.items())

# Longest base first so e.g. weave:/skos: win over any shorter shared prefix.
_CURIE_BASES: list[tuple[str, str]] = sorted(PREFIXES.items(), key=lambda kv: -len(kv[1]))


def curie(iri: str) -> str:
    """Compact an IRI to ``prefix:local`` using the known PREFIXES, else return it."""
    for prefix, base in _CURIE_BASES:
        if iri.startswith(base):
            return f"{prefix}:{iri[len(base):]}"
    return iri


# --- Node kinds -------------------------------------------------------------
# Ordered most-specific first; used to pick the primary kind of a node that
# carries several rdf:type values. Each entry maps a kind key to its class IRI
# and a default colour the canvas uses when the node has no explicit colour.

NODE_KINDS: list[dict[str, str]] = [
    {"key": "BusinessDomain", "iri": WEAVE + "BusinessDomain", "color": "#7c3aed"},
    {"key": "BusinessCapability", "iri": WEAVE + "BusinessCapability", "color": "#db2777"},
    {"key": "System", "iri": WEAVE + "System", "color": "#2563eb"},
    {"key": "Service", "iri": WEAVE + "Service", "color": "#0891b2"},
    {"key": "DataAsset", "iri": WEAVE + "DataAsset", "color": "#16a34a"},
    {"key": "Field", "iri": WEAVE + "Field", "color": "#65a30d"},
    {"key": "Concept", "iri": SKOS + "Concept", "color": "#ea580c"},
    {"key": "Class", "iri": OWL + "Class", "color": "#d97706"},
]

KIND_BY_IRI: dict[str, dict[str, str]] = {k["iri"]: k for k in NODE_KINDS}
KIND_BY_KEY: dict[str, dict[str, str]] = {k["key"]: k for k in NODE_KINDS}
DEFAULT_KIND = "Concept"


# --- Relationship vocabulary -----------------------------------------------
# The seeded predicates users can pick from in forms and the LLM can emit.

RELATIONSHIP_TYPES: list[dict[str, str]] = [
    {"key": "dependsOn", "iri": WEAVE + "dependsOn", "label": "depends on"},
    {"key": "partOf", "iri": WEAVE + "partOf", "label": "part of"},
    {"key": "realizes", "iri": WEAVE + "realizes", "label": "realizes"},
    {"key": "owns", "iri": WEAVE + "owns", "label": "owns"},
    {"key": "exposes", "iri": WEAVE + "exposes", "label": "exposes"},
    {"key": "describes", "iri": WEAVE + "describes", "label": "describes"},
    {"key": "broader", "iri": SKOS + "broader", "label": "broader"},
    {"key": "narrower", "iri": SKOS + "narrower", "label": "narrower"},
    {"key": "related", "iri": SKOS + "related", "label": "related"},
]

REL_BY_IRI: dict[str, dict[str, str]] = {r["iri"]: r for r in RELATIONSHIP_TYPES}
REL_BY_KEY: dict[str, dict[str, str]] = {r["key"]: r for r in RELATIONSHIP_TYPES}

# Predicates that are structural/annotation, never rendered as graph edges.
NON_EDGE_PREDICATES: set[str] = {
    RDF + "type",
    RDFS + "label",
    RDFS + "comment",
    SKOS + "definition",
    SKOS + "prefLabel",
    WEAVE + "note",
    WEAVE + "color",
    WEAVE + "x",
    WEAVE + "y",
    WEAVE + "inDomain",
    WEAVE + "hasCapability",
    WEAVE + "maturity",
    WEAVE + "targetMaturity",
    WEAVE + "strategicImportance",
    WEAVE + "investmentLevel",
    WEAVE + "lifecycleStatus",
    WEAVE + "capabilityOwner",
    DCTERMS + "created",
    PROV + "wasGeneratedBy",
    PROV + "wasAttributedTo",
    # Reification statement structure.
    RDF + "subject",
    RDF + "predicate",
    RDF + "object",
}
