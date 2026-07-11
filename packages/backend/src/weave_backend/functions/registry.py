"""CE-FUNCTION-1 (AC-009-02/-03/-06): `GET /api/functions` list +
`GET /api/functions/{iri}` detail, derived on read from the resolved
version graph (never stored) -- same CE-BRAND-1 projection-cache pattern
ADR-009 cites: cacheable by graph version, never hand-edited.
"""

from __future__ import annotations

import asyncpg
from rdflib import RDF, Graph, Namespace, URIRef

from weave_backend.functions.converter import to_json_schema
from weave_backend.functions.signature import (
    ParamSignature,
    classify_breaking,
    extract_signature,
)
from weave_backend.operations import versioning
from weave_backend.rdf.oxigraph_client import fetch_graph_turtle
from weave_backend.schemas.functions import (
    FunctionDetail,
    FunctionListEntry,
    ParamOut,
    SignatureOut,
)

WEAVE = Namespace("https://weave.io/ontology/")

#: ponytail: unbounded process-lifetime cache, no eviction -- published
#: version graphs are immutable so this never goes stale; add an LRU bound
#: if the per-tenant version count ever makes this a real memory concern.
_graph_cache: dict[str, Graph] = {}


def _local_name(iri: str) -> str:
    return iri.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


async def _load_graph(version_iri: str) -> Graph:
    if version_iri in _graph_cache:
        return _graph_cache[version_iri]
    turtle = await fetch_graph_turtle(version_iri)
    graph = Graph()
    if turtle:
        graph.parse(data=turtle, format="turtle")
    _graph_cache[version_iri] = graph
    return graph


def _param_out(graph: Graph, sig: ParamSignature, node: URIRef | None) -> ParamOut:
    name = str(graph.value(node, WEAVE.label)) if node is not None else ""
    return ParamOut(name=name, kind_iri=sig.kind_iri, shape_iri=sig.shape_iri)


def _param_order(graph: Graph, node: URIRef) -> int:
    order = graph.value(node, WEAVE.paramOrder)
    return int(str(order)) if order is not None else 0


def _signature_out(graph: Graph, fn: URIRef) -> SignatureOut | None:
    sig = extract_signature(graph, str(fn))
    if sig is None:
        return None
    param_nodes = sorted(
        (URIRef(str(n)) for n in graph.objects(fn, WEAVE.hasParameter)),
        key=lambda n: _param_order(graph, n),
    )
    return_node = graph.value(fn, WEAVE.hasReturn)
    return_iri = URIRef(str(return_node)) if return_node is not None else None
    return SignatureOut(
        bound_kind=sig.bound_kind,
        params=[_param_out(graph, p, n) for p, n in zip(sig.params, param_nodes, strict=True)],
        return_=_param_out(graph, sig.return_, return_iri),
    )


def _list_entry(
    graph: Graph, fn: URIRef, *, version_iri: str, previous_graph: Graph | None
) -> FunctionListEntry | None:
    signature = _signature_out(graph, fn)
    if signature is None:
        return None
    new_sig = extract_signature(graph, str(fn))
    old_sig = extract_signature(previous_graph, str(fn)) if previous_graph is not None else None
    status_literal = graph.value(fn, WEAVE.status)
    name_literal = graph.value(fn, WEAVE.label)
    return FunctionListEntry(
        fn_iri=str(fn),
        name=str(name_literal) if name_literal is not None else _local_name(str(fn)),
        bound_kind=signature.bound_kind,
        signature=signature,
        version_iri=version_iri,
        status=str(status_literal) if status_literal is not None else "active",
        breaking=classify_breaking(old_sig, new_sig) if new_sig is not None else False,
    )


def build_list_entries(
    graph: Graph, *, version_iri: str, previous_graph: Graph | None
) -> list[FunctionListEntry]:
    entries: list[FunctionListEntry] = []
    for fn in graph.subjects(RDF.type, WEAVE.Function):
        fn_iri = URIRef(str(fn))
        entry = _list_entry(graph, fn_iri, version_iri=version_iri, previous_graph=previous_graph)
        if entry is not None:
            entries.append(entry)
    return entries


async def _resolve_latest_iri(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> str:
    """AC-009-01: a just-defined function lands in the tenant *draft* graph
    via CE-WRITE-1 (publish is a separate, later step) -- so reads must
    surface the newest version *including* drafts. This differs from
    CE-VERSION-1's `?version=latest` alias (`versioning.resolve_version`),
    which is published-only (AC-002-08) and stays that way for the
    AC-009-04 immutability check.
    """
    page = await versioning.list_versions(
        conn,
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        page=versioning.Page(number=1, size=1),
        include_drafts=True,
    )
    if not page.versions:
        raise versioning.VersionNotFound("latest")
    return page.versions[0].version_iri


async def _resolve_previous_published(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, latest_iri: str
) -> str | None:
    """AC-009-05: diff against the *previous* published version, not draft
    history (Implementation Hints).
    """
    page = await versioning.list_versions(
        conn,
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        page=versioning.Page(number=1, size=2),
        include_drafts=False,
    )
    for version in page.versions:
        if version.version_iri != latest_iri:
            return version.version_iri
    return None


async def list_functions(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> list[FunctionListEntry]:
    latest_iri = await _resolve_latest_iri(
        conn, tenant_id=tenant_id, workspace_id=workspace_id
    )
    graph = await _load_graph(latest_iri)
    previous_iri = await _resolve_previous_published(
        conn, tenant_id=tenant_id, workspace_id=workspace_id, latest_iri=latest_iri
    )
    previous_graph = await _load_graph(previous_iri) if previous_iri else None
    return build_list_entries(graph, version_iri=latest_iri, previous_graph=previous_graph)


def _derive_json_schema(graph: Graph, signature: SignatureOut) -> dict[str, object]:
    """AC-009-03: the pseudocode's `to_json_schema(param)` is per-parameter --
    the function-level schema aggregates one derived fragment per declared
    parameter (keyed by name, falling back to its position) plus the return.
    """
    properties = {}
    for index, param in enumerate(signature.params):
        key = param.name or f"param{index}"
        properties[key] = to_json_schema(graph, param.kind_iri, param.shape_iri)
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties.keys()),
        "returns": to_json_schema(graph, signature.return_.kind_iri, signature.return_.shape_iri),
    }


async def get_function(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, fn_iri: str
) -> FunctionDetail | None:
    latest_iri = await _resolve_latest_iri(
        conn, tenant_id=tenant_id, workspace_id=workspace_id
    )
    graph = await _load_graph(latest_iri)
    fn = URIRef(fn_iri)
    if (fn, RDF.type, WEAVE.Function) not in graph:
        return None
    previous_iri = await _resolve_previous_published(
        conn, tenant_id=tenant_id, workspace_id=workspace_id, latest_iri=latest_iri
    )
    previous_graph = await _load_graph(previous_iri) if previous_iri else None
    entry = _list_entry(graph, fn, version_iri=latest_iri, previous_graph=previous_graph)
    if entry is None:
        return None
    schema = _derive_json_schema(graph, entry.signature)
    return FunctionDetail(**entry.model_dump(), json_schema=schema)
