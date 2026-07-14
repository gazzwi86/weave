"""CE-V1-TASK-009 AC-009-02: list-entry shape, `version_iri` from CE-VERSION-1
resolution (never a per-function lineage).
"""

from __future__ import annotations

import inspect

from rdflib import RDF, XSD, Graph, Literal, Namespace, URIRef

from weave_backend.functions import registry
from weave_backend.functions.registry import build_list_entries
from weave_backend.schemas import functions as functions_schemas

WEAVE = Namespace("https://weave.io/ontology/")
VERSION_IRI = "urn:weave:tenant:t1:ws:w1:v0.1.0"


def _seed_function(graph: Graph, *, label: str, status: str = "active") -> URIRef:
    fn = URIRef(f"https://weave.io/instances/fn-{label}")
    param = URIRef(f"https://weave.io/instances/param-{label}")
    ret = URIRef(f"https://weave.io/instances/ret-{label}")
    graph.add((fn, RDF.type, WEAVE.Function))
    graph.add((fn, WEAVE.label, Literal(label, datatype=XSD.string)))
    graph.add((fn, WEAVE.status, Literal(status, datatype=XSD.string)))
    graph.add((fn, WEAVE.boundKind, WEAVE.Activity))
    graph.add((fn, WEAVE.hasParameter, param))
    graph.add((param, WEAVE.paramOrder, Literal(0)))
    graph.add((param, WEAVE.paramKind, WEAVE.DataAsset))
    graph.add((fn, WEAVE.hasReturn, ret))
    graph.add((ret, WEAVE.paramKind, WEAVE.Activity))
    return fn


def test_build_list_entries_uses_ce_version_1_version_iri() -> None:
    graph = Graph()
    _seed_function(graph, label="reorderStock")

    entries = build_list_entries(graph, version_iri=VERSION_IRI, previous_graph=None)

    assert len(entries) == 1
    assert entries[0].version_iri == VERSION_IRI
    assert entries[0].fn_iri == "https://weave.io/instances/fn-reorderStock"
    assert entries[0].name == "reorderStock"
    assert entries[0].bound_kind == str(WEAVE.Activity)
    assert entries[0].status == "active"
    assert entries[0].breaking is False


def test_build_list_entries_flags_breaking_against_previous_published_graph() -> None:
    previous = Graph()
    _seed_function(previous, label="reorderStock")
    previous.remove((None, WEAVE.paramKind, WEAVE.DataAsset))
    previous_param = URIRef("https://weave.io/instances/param-reorderStock")
    previous.add((previous_param, WEAVE.paramKind, WEAVE.System))

    current = Graph()
    _seed_function(current, label="reorderStock")

    entries = build_list_entries(current, version_iri=VERSION_IRI, previous_graph=previous)

    assert entries[0].breaking is True


def test_no_function_local_semver_field_anywhere_in_schemas() -> None:
    """AC-009-02: `version_iri` is the CE-VERSION-1 IRI -- no per-function
    lineage exists anywhere in the payload or storage. Schema introspection
    guards against a `semver`/`fn_version`-shaped field creeping back in.
    """
    forbidden_substrings = ("semver", "fn_version", "function_version")
    for _name, model in inspect.getmembers(functions_schemas, inspect.isclass):
        if not hasattr(model, "model_fields"):
            continue
        for field_name in model.model_fields:
            lowered = field_name.lower()
            assert not any(bad in lowered for bad in forbidden_substrings), (
                f"{model.__name__}.{field_name} looks like function-local versioning"
            )


def test_registry_module_has_no_module_level_semver_state() -> None:
    assert not hasattr(registry, "semver")
