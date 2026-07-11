"""CE-V1-TASK-009 AC-009-05: fail-closed breaking-change classification.

param added/removed/retyped, or return changed => breaking; label/
description edits => not breaking; any unclassified change class defaults
to breaking (ADR-009 Decision 3).
"""

from __future__ import annotations

from rdflib import RDF, XSD, Graph, Literal, Namespace, URIRef

from weave_backend.functions.signature import (
    FunctionSignature,
    ParamSignature,
    classify_breaking,
    extract_signature,
)

WEAVE = Namespace("https://weave.io/ontology/")

BOUND_KIND = "https://weave.io/ontology/Activity"
ASSET_KIND = "https://weave.io/ontology/DataAsset"
SYSTEM_KIND = "https://weave.io/ontology/System"


def _sig(*, params: tuple[ParamSignature, ...], return_kind: str = ASSET_KIND) -> FunctionSignature:
    return FunctionSignature(
        bound_kind=BOUND_KIND,
        params=params,
        return_=ParamSignature(kind_iri=return_kind, shape_iri=None),
    )


def test_no_previous_signature_is_not_breaking() -> None:
    new = _sig(params=(ParamSignature(kind_iri=ASSET_KIND, shape_iri=None),))

    assert classify_breaking(None, new) is False


def test_identical_signature_is_not_breaking() -> None:
    sig = _sig(params=(ParamSignature(kind_iri=ASSET_KIND, shape_iri=None),))

    assert classify_breaking(sig, sig) is False


def test_param_added_is_breaking() -> None:
    old = _sig(params=(ParamSignature(kind_iri=ASSET_KIND, shape_iri=None),))
    new = _sig(
        params=(
            ParamSignature(kind_iri=ASSET_KIND, shape_iri=None),
            ParamSignature(kind_iri=SYSTEM_KIND, shape_iri=None),
        )
    )

    assert classify_breaking(old, new) is True


def test_param_removed_is_breaking() -> None:
    old = _sig(
        params=(
            ParamSignature(kind_iri=ASSET_KIND, shape_iri=None),
            ParamSignature(kind_iri=SYSTEM_KIND, shape_iri=None),
        )
    )
    new = _sig(params=(ParamSignature(kind_iri=ASSET_KIND, shape_iri=None),))

    assert classify_breaking(old, new) is True


def test_param_retyped_is_breaking() -> None:
    old = _sig(params=(ParamSignature(kind_iri=ASSET_KIND, shape_iri=None),))
    new = _sig(params=(ParamSignature(kind_iri=SYSTEM_KIND, shape_iri=None),))

    assert classify_breaking(old, new) is True


def test_return_kind_changed_is_breaking() -> None:
    old = _sig(params=(), return_kind=ASSET_KIND)
    new = _sig(params=(), return_kind=SYSTEM_KIND)

    assert classify_breaking(old, new) is True


def test_bound_kind_changed_is_breaking_fail_closed() -> None:
    """Not explicitly enumerated by AC-009-05's param/return list -- an
    unclassified change class defaults to breaking (fail-closed).
    """
    return_sig = ParamSignature(ASSET_KIND, None)
    old = FunctionSignature(bound_kind=BOUND_KIND, params=(), return_=return_sig)
    new = FunctionSignature(bound_kind=SYSTEM_KIND, params=(), return_=return_sig)

    assert classify_breaking(old, new) is True


def test_param_shape_narrowed_is_breaking() -> None:
    old = _sig(params=(ParamSignature(kind_iri=ASSET_KIND, shape_iri=None),))
    new = _sig(
        params=(ParamSignature(kind_iri=ASSET_KIND, shape_iri="https://weave.io/instances/s1"),)
    )

    assert classify_breaking(old, new) is True


def _function_graph(*, label: str, status_datatype: URIRef = XSD.string) -> tuple[Graph, URIRef]:
    graph = Graph()
    fn = URIRef("https://weave.io/instances/fn-1")
    param = URIRef("https://weave.io/instances/param-1")
    ret = URIRef("https://weave.io/instances/ret-1")
    graph.add((fn, RDF.type, WEAVE.Function))
    graph.add((fn, WEAVE.label, Literal(label, datatype=XSD.string)))
    graph.add((fn, WEAVE.boundKind, URIRef(BOUND_KIND)))
    graph.add((fn, WEAVE.hasParameter, param))
    graph.add((param, WEAVE.paramOrder, Literal(0)))
    graph.add((param, WEAVE.paramKind, URIRef(ASSET_KIND)))
    graph.add((fn, WEAVE.hasReturn, ret))
    graph.add((ret, WEAVE.paramKind, URIRef(ASSET_KIND)))
    return graph, fn


def test_extract_signature_reads_bound_kind_ordered_params_and_return() -> None:
    graph, fn = _function_graph(label="reorderStock")

    sig = extract_signature(graph, str(fn))

    assert sig == FunctionSignature(
        bound_kind=BOUND_KIND,
        params=(ParamSignature(kind_iri=ASSET_KIND, shape_iri=None),),
        return_=ParamSignature(kind_iri=ASSET_KIND, shape_iri=None),
    )


def test_extract_signature_unaffected_by_label_change() -> None:
    """AC-009-05: label/description edits are non-breaking -- the extracted
    signature (what breaking classification diffs) must be identical
    regardless of the function's own label.
    """
    graph_a, fn_a = _function_graph(label="reorderStock")
    graph_b, fn_b = _function_graph(label="reorderStockV2")

    assert extract_signature(graph_a, str(fn_a)) == extract_signature(graph_b, str(fn_b))


def test_extract_signature_returns_none_when_function_not_present() -> None:
    graph = Graph()

    assert extract_signature(graph, "https://weave.io/instances/missing") is None
