"""SHACL evaluation for CE-WRITE-1 (AC-001-02/-03).

The framework shapes graph is loaded lazily, on first use, from the static
`framework.shacl.ttl` file and cached for the life of the process (CE
ADR-001) -- not at startup, and there is no production invalidation path;
a shape-file edit needs a process restart to take effect until shape-
authoring (per-tenant custom shapes) lands in a later task. Tenant shapes
are out of scope here -- this module only ever loads the framework file.
Validation runs with `inference='none'` (Polikoff rule): SHACL checks
exactly the submitted triples, no OWL reasoning folded in first.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from pyshacl import validate
from rdflib import Graph
from rdflib.namespace import SH
from rdflib.term import Node, URIRef

_FRAMEWORK_SHAPES_PATH = (
    Path(__file__).resolve().parent.parent / "ontology" / "shapes" / "framework.shacl.ttl"
)

_shapes_graph_cache: Graph | None = None


def _load_shapes_graph() -> Graph:
    global _shapes_graph_cache
    if _shapes_graph_cache is None:
        graph = Graph()
        graph.parse(_FRAMEWORK_SHAPES_PATH, format="turtle")
        _shapes_graph_cache = graph
    return _shapes_graph_cache


def reset_shapes_cache_for_tests() -> None:
    """Test-only hook: forces the next `validate_graph` call to reload the
    shapes file from disk, so shape-file edits are picked up between tests.
    """
    global _shapes_graph_cache
    _shapes_graph_cache = None


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
