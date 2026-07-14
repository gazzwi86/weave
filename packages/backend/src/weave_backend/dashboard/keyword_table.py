"""AC-3 latency contingency (ADR-012, m2-delta.md §3): a rule-based
keyword -> spec table used ONLY to emit a provisional `spec` event when the
real resolver can't hit the p95 ≤ 1s target. TASK-012's own rule-based
fallback path reads this same table. Data only -- neither this module nor
its caller may use it to gate `source_not_ga`/`unsatisfiable` (the registry
and resolver own those, m2-delta.md §2 Design Decisions).
"""

from __future__ import annotations

from typing import TypedDict

from weave_backend.schemas.dashboard import ComponentType, WidgetSpec


class _KeywordEntry(TypedDict):
    component_type: ComponentType
    title: str
    contract: str
    field: str


#: keyword (matched as a case-insensitive substring of the prompt) -> the
#: provisional spec to render immediately while the real resolver runs.
#: Deliberately small -- just enough for a sensible-looking placeholder.
KEYWORD_TABLE: dict[str, _KeywordEntry] = {
    "compliance": {
        "component_type": "bar_chart",
        "title": "Compliance overview",
        "contract": "CE-METRICS-1",
        "field": "shacl_errors_by_severity",
    },
    "contravention": {
        "component_type": "bar_chart",
        "title": "Compliance overview",
        "contract": "CE-METRICS-1",
        "field": "shacl_errors_by_severity",
    },
    "entit": {  # matches "entity"/"entities"
        "component_type": "kpi_card",
        "title": "Entities in model",
        "contract": "CE-METRICS-1",
        "field": "entity_count_by_kind",
    },
}

#: Fallback when no keyword matches -- always a real, renderable spec.
_DEFAULT_ENTRY: _KeywordEntry = KEYWORD_TABLE["entit"]


def provisional_spec_from_keywords(prompt: str) -> WidgetSpec:
    lowered = prompt.lower()
    entry = next(
        (value for key, value in KEYWORD_TABLE.items() if key in lowered),
        _DEFAULT_ENTRY,
    )
    return WidgetSpec(
        component_type=entry["component_type"],
        title=entry["title"],
        data_source_contracts=[entry["contract"]],
        bindings={"field": entry["field"]},
        column_span=2,
    )
