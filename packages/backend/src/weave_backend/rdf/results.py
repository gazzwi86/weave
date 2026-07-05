"""CE-TASK-007: shapes SPARQL-JSON bindings into the `{column: value}` row
form the frontend's results table (and the NL query response, AC-007-01)
consume -- shared by `routers/sparql.py`'s `pattern=` path and
`routers/query.py`'s NL path so both render identically (ADR-005 #3).
"""

from __future__ import annotations

from typing import Any


def bindings_to_rows(
    bindings: list[dict[str, Any]], column_names: list[str]
) -> list[dict[str, str]]:
    """Extracts `binding[name]["value"]` for each `column_names` entry that
    is actually bound in a given row -- an unbound (e.g. OPTIONAL) column is
    simply absent from that row's dict, never a KeyError.
    """
    return [
        {name: binding[name]["value"] for name in column_names if name in binding}
        for binding in bindings
    ]
