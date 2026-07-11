"""CE-BRAND-1 (TASK-003, EPIC-004): pure flatteners over `{column: value}`
SPARQL rows (same shape `rdf/results.py::bindings_to_rows` produces) --
no store access, so these are fully unit-testable against plain dict
fixtures (task brief implementation hint).

ADR-022 records the RDF-encoding decisions these functions implement:
`contentType` selects the token JSON key (closed-core or `extensions`),
`sourceUri`-only individuals are asset references excluded from the token
output, and duplicate `contentType` rows shallow-merge in the order given
(the caller's SELECT is `ORDER BY ?s`, so this is deterministic).

Neither function re-validates its input against the SHACL shapes --
CE-WRITE-1's commit-time gate already guarantees only conforming
individuals exist (m2-delta.md §4); re-filtering here would silently mask
a gate bug instead of surfacing it.
"""

from __future__ import annotations

import json
from typing import Any

_CLOSED_CORE_KEYS = ("color", "typography", "spacing", "radius")


def flatten_tokens(rows: list[dict[str, str]]) -> dict[str, Any]:
    """AC-003-03: merges `BrandStandard` rows into the closed-core +
    `extensions` token JSON shape. A row with no `contentBody` (a
    `sourceUri`-only asset reference) contributes nothing to the output.
    """
    result: dict[str, Any] = {key: {} for key in _CLOSED_CORE_KEYS}
    result["extensions"] = {}
    for row in rows:
        content_body = row.get("contentBody")
        if content_body is None:
            continue
        content_type = row["contentType"]
        parsed = json.loads(content_body)
        if content_type in _CLOSED_CORE_KEYS:
            result[content_type].update(parsed)
        else:
            result["extensions"][content_type] = parsed
    return result


def extract_voice_rules(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    """AC-003-04: maps `VoiceRule` rows to `{id, severity, assertion}` --
    `humanLabel` (governance/display only) is deliberately dropped.
    """
    return [
        {"id": row["ruleId"], "severity": row["severity"], "assertion": row["assertion"]}
        for row in rows
    ]
