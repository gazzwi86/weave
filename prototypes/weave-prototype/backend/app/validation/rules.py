"""Derive human-readable if/then rules from the SHACL shapes.

The shapes in :mod:`shapes` are the constraints actually enforced when the graph
is written. This turns them into a readable, grouped rulebook so users can see
the rules that govern the system without reading Turtle — the same single source
of truth that validation uses, never a hand-maintained parallel list.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from .. import namespaces as ns
from .shacl import shapes_graph

_RULES_QUERY = """
PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT ?shape ?path ?cls ?message ?severity WHERE {
  ?shape a sh:NodeShape ;
         sh:property ?prop .
  ?prop sh:path ?path .
  OPTIONAL { ?prop sh:class ?cls }
  OPTIONAL { ?prop sh:message ?message }
  OPTIONAL { ?prop sh:severity ?severity }
}
"""

# Object kind → the category a rule is grouped under in the UI. This is a
# presentational grouping (a friendlier header than the bare kind name), not a
# source of constraints — the rules themselves still derive only from the shapes.
_CATEGORY_BY_KIND: dict[str, str] = {
    "BusinessDomain": "Domain classification",
    "BusinessCapability": "Capability assignment",
    "Concept": "Concept linking",
}
_DEFAULT_CATEGORY = "Structure"


@lru_cache(maxsize=1)
def schema_rules() -> list[dict[str, Any]]:
    """Introspect the SHACL shapes into structured, grouped if/then rules."""
    rules: list[dict[str, Any]] = []
    for row in shapes_graph().query(_RULES_QUERY):
        if row.cls is None:
            continue
        kind = ns.local_name(str(row.cls))
        rules.append(
            {
                "id": ns.local_name(str(row.shape)),
                "category": _CATEGORY_BY_KIND.get(kind, _DEFAULT_CATEGORY),
                "relationship": ns.local_name(str(row.path)),
                "object_kind": kind,
                "object_kind_curie": ns.curie(str(row.cls)),
                "severity": ns.local_name(str(row.severity)) if row.severity else "Violation",
                "message": str(row.message) if row.message else None,
            }
        )
    rules.sort(key=lambda r: (r["category"], r["relationship"]))
    return rules
