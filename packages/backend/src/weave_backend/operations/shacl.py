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

from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from pyshacl import validate
from rdflib import Graph, Literal
from rdflib.namespace import SH
from rdflib.term import Node, URIRef

_UNIQUE_LANG_COMPONENT = URIRef("http://www.w3.org/ns/shacl#UniqueLangConstraintComponent")

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


def shapes_graph() -> Graph:
    """Public accessor for the cached framework shapes graph -- lets other
    modules (e.g. `ontology/catalogue.py`'s CE-READ-1 kind/relationship
    introspection) share the same lazily-loaded cache instead of re-parsing
    `framework.shacl.ttl` themselves.
    """
    return _load_shapes_graph()


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


def _duplicate_languages(data_graph: Graph, focus_node: Node, path: Node) -> list[str]:
    """Language tags that appear more than once on `(focus_node, path)` in
    `data_graph` -- used to enrich the fixed `sh:uniqueLang` shape message,
    which never names the colliding language on its own (AC-001-03).
    """
    counts = Counter(
        value.language
        for value in data_graph.objects(URIRef(str(focus_node)), URIRef(str(path)))
        if isinstance(value, Literal) and value.language
    )
    return sorted(lang for lang, count in counts.items() if count > 1)


def _enrich_unique_lang_message(message: str, langs: list[str]) -> str:
    if not langs:
        return message
    return f"{message} (duplicate language tag: {', '.join(langs)})"


def _to_result(report: Graph, result_node: Node, data_graph: Graph) -> ShaclResult:
    severity = report.value(result_node, SH.resultSeverity)
    focus_node = report.value(result_node, SH.focusNode)
    path = report.value(result_node, SH.resultPath)
    message = report.value(result_node, SH.resultMessage)
    component = report.value(result_node, SH.sourceConstraintComponent)
    severity_label = (
        _SEVERITY_LABELS.get(URIRef(str(severity)), str(severity))
        if severity is not None
        else "Unknown"
    )
    message_text = str(message) if message is not None else ""
    if component == _UNIQUE_LANG_COMPONENT and focus_node is not None and path is not None:
        langs = _duplicate_languages(data_graph, focus_node, path)
        message_text = _enrich_unique_lang_message(message_text, langs)
    return ShaclResult(
        focus_node=str(focus_node) if focus_node is not None else "",
        path=str(path) if path is not None else None,
        severity=severity_label,
        message=message_text,
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
    return [_to_result(results_graph, node, data_graph) for node in result_nodes]
