"""Run SHACL validation over a Turtle data graph and surface the violations."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from .shapes import SHACL_SHAPES

_RESULTS_QUERY = """
PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT ?focus ?path ?message ?severity WHERE {
  ?r a sh:ValidationResult ;
     sh:focusNode ?focus ;
     sh:resultSeverity ?severity .
  OPTIONAL { ?r sh:resultPath ?path }
  OPTIONAL { ?r sh:resultMessage ?message }
}
"""


@lru_cache(maxsize=1)
def shapes_graph():
    """The parsed SHACL shapes graph (cached); merged static + custom rules."""
    from rdflib import Graph

    from .custom_rules import custom_shapes_turtle

    g = Graph().parse(data=SHACL_SHAPES, format="turtle")
    extra = custom_shapes_turtle()
    if extra:
        g.parse(data=extra, format="turtle")
    return g


def _extract_results(results_graph) -> list[dict[str, Any]]:
    violations = []
    for row in results_graph.query(_RESULTS_QUERY):
        violations.append(
            {
                "focus": str(row.focus),
                "path": str(row.path) if row.path else None,
                "message": str(row.message) if row.message else None,
                "severity": str(row.severity),
            }
        )
    return violations


def validate_turtle(data_ttl: str) -> list[dict[str, Any]]:
    """Validate a Turtle graph against the Weave shapes; [] means it conforms."""
    from pyshacl import validate
    from rdflib import Graph

    data_graph = Graph().parse(data=data_ttl, format="turtle")
    conforms, results_graph, _text = validate(
        data_graph, shacl_graph=shapes_graph(), inference="none"
    )
    if conforms:
        return []
    return _extract_results(results_graph)
