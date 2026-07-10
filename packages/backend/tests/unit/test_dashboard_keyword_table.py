"""AC-3 latency contingency: the keyword table is data, not gating logic --
it serves only the provisional-spec fallback (Implementation Hints; never
`source_not_ga`/`unsatisfiable`, which belong to the resolver + registry).
"""

from __future__ import annotations

from weave_backend.dashboard.keyword_table import provisional_spec_from_keywords
from weave_backend.schemas.dashboard import WidgetSpec


def test_known_keyword_maps_to_matching_spec() -> None:
    spec = provisional_spec_from_keywords("show me compliance contraventions by domain")
    assert isinstance(spec, WidgetSpec)
    assert spec.data_source_contracts == ["CE-METRICS-1"]


def test_unknown_prompt_falls_back_to_default_entry() -> None:
    spec = provisional_spec_from_keywords("gibberish with no match at all")
    assert isinstance(spec, WidgetSpec)
    assert spec.data_source_contracts == ["CE-METRICS-1"]


def test_lookup_is_case_insensitive() -> None:
    lower = provisional_spec_from_keywords("compliance status")
    upper = provisional_spec_from_keywords("COMPLIANCE STATUS")
    assert lower.title == upper.title
