"""CE-FUNCTION-1 (AC-009-05): a function's structural signature -- bound
kind, ordered params, return -- and fail-closed breaking-change
classification (ADR-009 Decision 3).

Deliberately excludes `weave:label`/`weave:description`: those never
participate in `FunctionSignature` equality, so a label/description-only
edit is structurally non-breaking without any special-case branch.
"""

from __future__ import annotations

from dataclasses import dataclass

from rdflib import RDF, Graph, Namespace, URIRef

WEAVE = Namespace("https://weave.io/ontology/")


@dataclass(frozen=True)
class ParamSignature:
    kind_iri: str
    shape_iri: str | None


@dataclass(frozen=True)
class FunctionSignature:
    bound_kind: str
    #: Declared order preserved (Implementation Hints: sort by
    #: `weave:paramOrder` before diffing -- otherwise reordering
    #: serialisation falsely reads as breaking).
    params: tuple[ParamSignature, ...]
    return_: ParamSignature


def classify_breaking(old: FunctionSignature | None, new: FunctionSignature) -> bool:
    """AC-009-05: param added/removed/retyped, or return changed => breaking;
    label/description edits => not (excluded from the dataclass entirely,
    see module docstring); any unclassified change class defaults to
    breaking (fail-closed) -- full structural equality achieves this without
    enumerating every possible change.
    """
    if old is None:
        return False
    return old != new


def _param_signature(graph: Graph, node: URIRef) -> ParamSignature:
    kind = graph.value(node, WEAVE.paramKind)
    shape = graph.value(node, WEAVE.paramShape)
    return ParamSignature(
        kind_iri=str(kind) if kind is not None else "",
        shape_iri=str(shape) if shape is not None else None,
    )


def _param_order(graph: Graph, node: URIRef) -> int:
    order = graph.value(node, WEAVE.paramOrder)
    return int(str(order)) if order is not None else 0


def _ordered_params(graph: Graph, fn: URIRef) -> tuple[ParamSignature, ...]:
    nodes = [URIRef(str(n)) for n in graph.objects(fn, WEAVE.hasParameter)]
    nodes.sort(key=lambda n: _param_order(graph, n))
    return tuple(_param_signature(graph, n) for n in nodes)


def extract_signature(graph: Graph, fn_iri: str) -> FunctionSignature | None:
    fn = URIRef(fn_iri)
    if (fn, RDF.type, WEAVE.Function) not in graph:
        return None

    bound_kind = graph.value(fn, WEAVE.boundKind)
    return_node = graph.value(fn, WEAVE.hasReturn)
    return_sig = (
        _param_signature(graph, URIRef(str(return_node)))
        if return_node is not None
        else ParamSignature(kind_iri="", shape_iri=None)
    )
    return FunctionSignature(
        bound_kind=str(bound_kind) if bound_kind is not None else "",
        params=_ordered_params(graph, fn),
        return_=return_sig,
    )
