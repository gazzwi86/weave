"""SHACL evaluation for CE-WRITE-1 (AC-001-02/-03, CE-TASK-005 AC-005-01..07).

The framework shapes graph is loaded lazily, on first use, from the static
`framework.shacl.ttl` file and cached for the life of the process (CE
ADR-001) -- not at startup, and there is no production invalidation path;
a shape-file edit needs a process restart to take effect. `validate_graph`
is the framework-only path (M1). `validate_graph_for_tenant` (CE-TASK-005)
extends the same loader with a tenant's own governance shapes, version-keyed
via Redis so a shape commit invalidates every worker's in-process cache on
the very next validation (m2-delta.md Sec2/Sec3) -- never another tenant's
shapes (ADR-001 fail-closed scoping extended to shapes, AC-005-03/-04).
Validation runs with `inference='none'` (Polikoff rule): SHACL checks
exactly the submitted triples, no OWL reasoning folded in first.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from pyshacl import validate
from rdflib import Graph
from rdflib.namespace import SH
from rdflib.term import Node, URIRef

from weave_backend.rdf.oxigraph_client import fetch_graph_ntriples

_FRAMEWORK_SHAPES_PATH = (
    Path(__file__).resolve().parent.parent / "ontology" / "shapes" / "framework.shacl.ttl"
)

#: AC-005-06/SS-EA-4: `weave:automatable`, when asserted at all, must be a
#: boolean -- absence is fine (downstream route-to-human default), so this
#: is `sh:targetSubjectsOf`, not a per-kind `sh:targetClass` shape. Kept out
#: of `framework.shacl.ttl` deliberately: that file is introspected by
#: `ontology/catalogue.py`'s CE-READ-1 (`subjects(SH.targetClass, None)`),
#: and a second `targetClass weave:Activity`/`weave:Process` shape there
#: would surface as a duplicate Kind. Always merged into the validation set
#: below instead (framework-wide, not truly "in the tenant shapes graph" --
#: see TASK-005 progress summary for the m2-delta wording this deviates from).
_AUTOMATABLE_SHAPE_TTL = """
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix weave: <https://weave.io/ontology/> .

weave:AutomatableShape a sh:NodeShape ;
    sh:targetSubjectsOf weave:automatable ;
    sh:property [
        sh:path weave:automatable ;
        sh:datatype xsd:boolean ;
        sh:maxCount 1 ;
        sh:severity sh:Violation ;
        sh:message "weave:automatable must be a boolean value when asserted."@en ;
    ] .
"""
_AUTOMATABLE_SHAPE_GRAPH = Graph().parse(data=_AUTOMATABLE_SHAPE_TTL, format="turtle")


class RedisLike(Protocol):
    async def set(
        self, key: str, value: str, *, nx: bool = False, ex: int | None = None
    ) -> object: ...
    async def get(self, key: str) -> str | None: ...


_shapes_graph_cache: Graph | None = None


def _load_shapes_graph() -> Graph:
    global _shapes_graph_cache
    if _shapes_graph_cache is None:
        graph = Graph()
        graph.parse(_FRAMEWORK_SHAPES_PATH, format="turtle")
        _shapes_graph_cache = graph
    return _shapes_graph_cache


def shapes_graph() -> Graph:
    """Public accessor for the cached framework shapes graph -- lets other
    modules (e.g. `ontology/catalogue.py`'s CE-READ-1 kind/relationship
    introspection) share the same lazily-loaded cache instead of re-parsing
    `framework.shacl.ttl` themselves.
    """
    return _load_shapes_graph()


@dataclass(frozen=True)
class ShaclResult:
    focus_node: str
    path: str | None
    severity: str
    message: str


_SEVERITY_LABELS = {SH.Violation: "Violation", SH.Warning: "Warning", SH.Info: "Info"}


def _to_result(report: Graph, result_node: Node) -> ShaclResult:
    severity = report.value(result_node, SH.resultSeverity)
    focus_node = report.value(result_node, SH.focusNode)
    path = report.value(result_node, SH.resultPath)
    message = report.value(result_node, SH.resultMessage)
    severity_label = (
        _SEVERITY_LABELS.get(URIRef(str(severity)), str(severity))
        if severity is not None
        else "Unknown"
    )
    return ShaclResult(
        focus_node=str(focus_node) if focus_node is not None else "",
        path=str(path) if path is not None else None,
        severity=severity_label,
        message=str(message) if message is not None else "",
    )


def validate_graph(data_graph: Graph) -> list[ShaclResult]:
    """Validates `data_graph` against the cached framework+tenant shapes.
    Returns every `sh:ValidationResult`, whatever its severity -- callers
    decide what to do with Violation vs Warning/Info.
    """
    shapes_graph = _load_shapes_graph()
    _conforms, results_graph, _text = validate(
        data_graph,
        shacl_graph=shapes_graph,
        inference="none",
        abort_on_first=False,
    )
    result_nodes = set(results_graph.subjects(SH.resultSeverity, None))
    return [_to_result(results_graph, node) for node in result_nodes]


def tenant_shapes_graph_iri(tenant_id: str) -> str:
    """AC-005-01/ADR-023: governance shapes are tenant-wide (no `:ws:`
    workspace segment), unlike ADR-001's per-workspace data-graph naming --
    a compliance rule applies to the whole tenant, not one workspace.
    """
    return f"urn:weave:g:tenant:{tenant_id}:shapes"


def _shapes_version_key(tenant_id: str) -> str:
    return f"ce:governance:shapes-version:{tenant_id}"


async def bump_shapes_version(redis_client: RedisLike, tenant_id: str) -> None:
    """Called on every tenant shapes-graph commit (addition, edit, *or*
    deletion -- the DoD pitfall note). A fresh token is the invalidation
    signal every worker's cache checks against on its next validation
    (AC-005-02); no pub/sub needed, Redis itself is the shared source of
    truth for "is my cached copy still current".
    """
    await redis_client.set(_shapes_version_key(tenant_id), uuid.uuid4().hex)


#: One cached merged (framework + AutomatableShape + tenant) shapes graph
#: per tenant, keyed by the Redis version token it was built from. A stale
#: entry (token mismatch) is replaced, not appended, so this stays bounded
#: to one entry per tenant regardless of how many times shapes are bumped.
_tenant_shapes_cache: dict[str, tuple[str, Graph]] = {}


def reset_shapes_cache_for_tests() -> None:
    """Test-only hook: forces the next `validate_graph`/
    `validate_graph_for_tenant` call to reload shapes from disk/store, so
    shape edits are picked up between tests.
    """
    global _shapes_graph_cache
    _shapes_graph_cache = None
    _tenant_shapes_cache.clear()


async def _tenant_shapes_graph(tenant_id: str, redis_client: RedisLike | None) -> Graph:
    version = (
        await redis_client.get(_shapes_version_key(tenant_id)) if redis_client is not None else None
    )
    if version is None:
        # AC-005-04 fail-closed default: no version token committed yet for
        # this tenant means no custom shapes exist -- never fetch the
        # tenant shapes graph at all (framework + AutomatableShape only).
        merged = Graph()
        merged += _load_shapes_graph()
        merged += _AUTOMATABLE_SHAPE_GRAPH
        return merged

    cached = _tenant_shapes_cache.get(tenant_id)
    if cached is not None and cached[0] == version:
        return cached[1]

    merged = Graph()
    merged += _load_shapes_graph()
    merged += _AUTOMATABLE_SHAPE_GRAPH
    ntriples = await fetch_graph_ntriples(tenant_shapes_graph_iri(tenant_id))
    if ntriples:
        merged.parse(data=ntriples, format="nt")
    _tenant_shapes_cache[tenant_id] = (version, merged)
    return merged


async def validate_graph_for_tenant(
    data_graph: Graph, *, tenant_id: str, redis_client: RedisLike | None
) -> list[ShaclResult]:
    """Tenant-scoped sibling of `validate_graph` (CE-TASK-005): validates
    against framework shapes union this tenant's own committed shapes only
    -- never another tenant's (AC-005-03/-04). `redis_client=None` is the
    M1-callers convenience path (idempotency-cache-less tests/callers):
    behaves exactly like framework-only `validate_graph`.
    """
    shapes = await _tenant_shapes_graph(tenant_id, redis_client)
    _conforms, results_graph, _text = validate(
        data_graph,
        shacl_graph=shapes,
        inference="none",
        abort_on_first=False,
    )
    result_nodes = set(results_graph.subjects(SH.resultSeverity, None))
    return [_to_result(results_graph, node) for node in result_nodes]
