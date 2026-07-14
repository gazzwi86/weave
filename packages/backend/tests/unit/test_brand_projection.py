"""TASK-003 (EPIC-004) unit tests: CE-BRAND-1's pure flatteners --
`flatten_tokens` (AC-003-03) and `extract_voice_rules` (AC-003-04) --
against plain `{column: value}` row fixtures (same shape
`rdf/results.py::bindings_to_rows` produces), never a real SPARQL store
(AC-003-06's docker perf case covers the store round trip).
"""

from __future__ import annotations

from weave_backend.brand.projection import extract_voice_rules, flatten_tokens

_COLOR_TOKENS = '{"primary": "#111111", "surface": "#ffffff"}'
_TYPOGRAPHY_TOKENS = '{"fontFamily": {"body": "Inter, sans-serif"}}'


def test_flatten_tokens_merges_matching_content_type_into_its_core_key() -> None:
    rows = [{"contentType": "color", "contentBody": _COLOR_TOKENS}]

    result = flatten_tokens(rows)

    assert result["color"] == {"primary": "#111111", "surface": "#ffffff"}


def test_flatten_tokens_always_returns_all_four_closed_core_keys() -> None:
    """AC-003-03: closed-core is a stable codegen target -- Build always
    gets `color`/`typography`/`spacing`/`radius`, even empty, never a
    missing key it has to guard for.
    """
    result = flatten_tokens([])

    assert result == {
        "color": {},
        "typography": {},
        "spacing": {},
        "radius": {},
        "extensions": {},
    }


def test_flatten_tokens_routes_unknown_content_type_into_extensions() -> None:
    rows = [{"contentType": "acme.logoRadius", "contentBody": '{"value": "12px"}'}]

    result = flatten_tokens(rows)

    assert result["extensions"] == {"acme.logoRadius": {"value": "12px"}}
    assert result["color"] == {}


def test_flatten_tokens_skips_source_uri_only_individuals() -> None:
    """A logo/asset-reference BrandStandard (sourceUri, no contentBody) has
    no field in the pinned token JSON shape -- excluded, not errored
    (ADR-022 decision 2)."""
    rows = [
        {"contentType": "logo", "sourceUri": "https://cdn.example.com/logo.svg"},
        {"contentType": "color", "contentBody": _COLOR_TOKENS},
    ]

    result = flatten_tokens(rows)

    assert result["color"] == {"primary": "#111111", "surface": "#ffffff"}
    assert result["extensions"] == {}


def test_flatten_tokens_merges_two_core_sections_independently() -> None:
    rows = [
        {"contentType": "color", "contentBody": _COLOR_TOKENS},
        {"contentType": "typography", "contentBody": _TYPOGRAPHY_TOKENS},
    ]

    result = flatten_tokens(rows)

    assert result["color"] == {"primary": "#111111", "surface": "#ffffff"}
    assert result["typography"] == {"fontFamily": {"body": "Inter, sans-serif"}}


def test_flatten_tokens_last_write_wins_on_duplicate_content_type() -> None:
    """ADR-022 decision 3: rows are already subject-IRI ordered by the
    caller's SELECT (`ORDER BY ?s`) -- the flattener just shallow-merges in
    the order given, so the later row wins on key collision.
    """
    rows = [
        {"contentType": "color", "contentBody": '{"primary": "#111111"}'},
        {"contentType": "color", "contentBody": '{"primary": "#222222"}'},
    ]

    result = flatten_tokens(rows)

    assert result["color"] == {"primary": "#222222"}


def test_flatten_tokens_does_not_re_filter_shacl_invalid_individuals() -> None:
    """AC-003-02 + m2-delta §4: the projection trusts CE-WRITE-1's
    commit-time SHACL gate completely -- it never re-validates or drops a
    row for looking "wrong"; whatever the SELECT returns, it emits.
    """
    rows = [{"contentType": "color", "contentBody": '{"primary": "not-a-real-colour"}'}]

    result = flatten_tokens(rows)

    assert result["color"] == {"primary": "not-a-real-colour"}


def test_extract_voice_rules_maps_rule_id_severity_assertion() -> None:
    rows = [
        {"ruleId": "no-jargon", "severity": "critical", "assertion": "forbidden_terms(['synergy'])"}
    ]

    result = extract_voice_rules(rows)

    assert result == [
        {"id": "no-jargon", "severity": "critical", "assertion": "forbidden_terms(['synergy'])"}
    ]


def test_extract_voice_rules_returns_empty_list_for_no_rows() -> None:
    assert extract_voice_rules([]) == []


def test_extract_voice_rules_drops_human_label_from_projection() -> None:
    """`humanLabel` is governance/display metadata (task brief Story
    section) -- Build's gate only needs the mechanically-evaluable fields,
    so it's not part of the CE-BRAND-1 shape even if the row carries it.
    """
    rows = [
        {
            "ruleId": "no-jargon",
            "severity": "normal",
            "assertion": "max_length(200)",
            "humanLabel": "Keep it punchy",
        }
    ]

    result = extract_voice_rules(rows)

    assert result == [{"id": "no-jargon", "severity": "normal", "assertion": "max_length(200)"}]
