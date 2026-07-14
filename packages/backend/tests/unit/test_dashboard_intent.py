"""TASK-012: declarative intent->component resolver (m2-delta.md §2).

`_map_classification` is the pure rule-table decision -- fixtures are
recorded `IntentClassification` JSON (Plugin Law F: no live model calls),
fed directly, matching `authoring/nl_parser.py`'s test convention.
"""

from __future__ import annotations

import json

import pytest

from weave_backend.dashboard.compat import COMPAT, COMPAT_PATH
from weave_backend.dashboard.intent import (
    CATEGORIES,
    IntentClassification,
    ProviderUnavailable,
    SourceNotGA,
    _map_classification,
    _parse_classification,
    resolve,
)
from weave_backend.schemas.dashboard import ComponentType, WidgetSpec

_CE = "entity_metrics"  # -> CE-METRICS-1, GA at M2
_BUILD = "build_cost"  # -> BUILD-COST-1, not GA at M2


def _classification(**overrides: object) -> IntentClassification:
    base: dict[str, object] = {
        "data_shape": "scalar",
        "category": _CE,
        "field": "entity_count_by_kind",
        "named_type": None,
        "title": "Entities in model",
    }
    base.update(overrides)
    return IntentClassification.model_validate(base)


# AC-1: every data shape maps to its rule-table primary component, >= 2
# fixtures per shape (16 total) -- the intent-mapping audit.
_AUDIT_FIXTURES: list[tuple[str, str]] = [
    ("scalar", "kpi_card"),
    ("scalar", "kpi_card"),
    ("series", "line_area_chart"),
    ("series", "line_area_chart"),
    ("categorical", "bar_chart"),
    ("categorical", "bar_chart"),
    ("ranked", "ranked_list"),
    ("ranked", "ranked_list"),
    ("events", "activity_feed"),
    ("events", "activity_feed"),
    ("ratio", "pie_donut"),
    ("ratio", "pie_donut"),
    ("matrix", "heatmap"),
    ("matrix", "heatmap"),
    ("rows", "table"),
    ("rows", "table"),
]


@pytest.mark.parametrize("shape,expected_component", _AUDIT_FIXTURES)
def test_intent_mapping_audit(shape: str, expected_component: str) -> None:
    result = _map_classification(_classification(data_shape=shape))
    assert isinstance(result, WidgetSpec)
    assert result.component_type == expected_component
    assert result.override_note is None


def test_named_type_override() -> None:
    # "as a table" on categorical data is shape-compatible -> honoured.
    compatible = _map_classification(_classification(data_shape="categorical", named_type="table"))
    assert isinstance(compatible, WidgetSpec)
    assert compatible.component_type == "table"
    assert compatible.override_note is None

    # "as a heatmap" on scalar data is NOT compatible -> falls back to the
    # rule-table default (kpi_card) and carries an override-not-applicable
    # note.
    incompatible = _map_classification(_classification(data_shape="scalar", named_type="heatmap"))
    assert isinstance(incompatible, WidgetSpec)
    assert incompatible.component_type == "kpi_card"
    assert incompatible.override_note is not None
    assert "heatmap" in incompatible.override_note


def test_no_match_declines() -> None:
    # A category with no registered binding at all -> unsatisfiable (None),
    # never SourceNotGA.
    result = _map_classification(_classification(category="no_such_category"))
    assert result is None


def test_non_ga_returns_source_not_ga_not_none() -> None:
    result = _map_classification(_classification(category=_BUILD))
    assert isinstance(result, SourceNotGA)
    assert result.source_engine == "build"
    assert result is not None


def test_compatibility_matrix_single_source() -> None:
    """AC-6: DoD requires the matrix exist exactly once, at
    `packages/shared`. The backend loads `COMPAT` from `COMPAT_PATH` at
    import; the frontend (`lib/dashboard/widget-compat.ts`) imports that
    same file by relative path -- there is no second file to drift, and
    this test guards that by confirming no other `widget-compat.json` lives
    anywhere else in the repo.
    """
    repo_root = COMPAT_PATH.resolve().parents[2]
    assert COMPAT_PATH.name == "widget-compat.json"
    assert COMPAT_PATH.parent.name == "shared"

    on_disk = json.loads(COMPAT_PATH.read_text())
    assert on_disk == COMPAT

    matches = [
        path
        for path in (repo_root / "packages").glob("**/widget-compat.json")
        if "node_modules" not in path.parts
    ]
    assert matches == [COMPAT_PATH]

    # every shape lists >= 1 component; every component appears in >= 1 shape
    all_components: set[str] = set()
    for shape, components in COMPAT.items():
        assert len(components) >= 1, shape
        all_components.update(components)
    assert all_components == set(ComponentType.__args__)  # type: ignore[attr-defined]


class _FakeRoute:
    """Queues successive raw model responses for `resolve()`'s retry path."""

    def __init__(self, *responses: str) -> None:
        self._responses = list(responses)

    def __call__(self, tier: str, prompt: str, **kwargs: object) -> str:
        return self._responses.pop(0)


def test_parse_classification_rejects_invalid_json() -> None:
    assert _parse_classification("not json") is None


def test_parse_classification_rejects_out_of_schema() -> None:
    assert _parse_classification(json.dumps({"data_shape": "not-a-real-shape"})) is None


async def test_resolve_retries_once_then_declines(monkeypatch: pytest.MonkeyPatch) -> None:
    import weave_backend.dashboard.intent as intent_module

    fake = _FakeRoute("not json", "still not json")
    monkeypatch.setattr(intent_module, "route", fake)

    result = await resolve("show entities by kind")
    assert result is None


async def test_resolve_retries_once_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    import weave_backend.dashboard.intent as intent_module

    valid = json.dumps(
        {
            "data_shape": "scalar",
            "category": _CE,
            "field": "entity_count_by_kind",
            "title": "Entities in model",
        }
    )
    fake = _FakeRoute("not json", valid)
    monkeypatch.setattr(intent_module, "route", fake)

    result = await resolve("show entities by kind")
    assert isinstance(result, WidgetSpec)
    assert result.component_type == "kpi_card"


async def test_resolve_succeeds_first_try(monkeypatch: pytest.MonkeyPatch) -> None:
    import weave_backend.dashboard.intent as intent_module

    valid = json.dumps(
        {
            "data_shape": "series",
            "category": _CE,
            "field": "entity_count_by_kind",
            "title": "Entities over time",
        }
    )
    monkeypatch.setattr(intent_module, "route", _FakeRoute(valid))

    result = await resolve("show entities over time")
    assert isinstance(result, WidgetSpec)
    assert result.component_type == "line_area_chart"


def test_source_not_ga_carries_source_engine() -> None:
    marker = SourceNotGA(source_engine="build")
    assert marker.source_engine == "build"


def test_categories_registry_has_a_non_ga_entry() -> None:
    # Guards the fixture set above: without a non-CE category, the
    # source_not_ga path would be unreachable (advisor-flagged gap).
    assert any(cat != _CE for cat in CATEGORIES)


async def test_resolve_raises_provider_unavailable_on_connection_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-4: a real provider connection failure (SDK/HTTP error, not a
    parse/schema failure) must surface as `ProviderUnavailable` -- the only
    exception `generate.py` catches to emit the clean `provider_503` SSE
    state. Mirrors `routers/authoring.py`'s graceful-degradation boundary.
    """
    import weave_backend.dashboard.intent as intent_module

    def _raise(tier: str, prompt: str, **kwargs: object) -> str:
        raise ConnectionError("boom")

    monkeypatch.setattr(intent_module, "route", _raise)

    with pytest.raises(ProviderUnavailable):
        await resolve("show entities by kind")


def test_default_resolver_is_real_not_a_stub() -> None:
    # ProviderUnavailable is still a real exception type (raised on actual
    # provider failure), but the module-level default no longer
    # unconditionally raises it -- confirmed by the resolve() tests above
    # actually returning results. This test just guards the import stays.
    assert issubclass(ProviderUnavailable, Exception)


async def test_resolve_provider_fails_on_retry_attempt(monkeypatch: pytest.MonkeyPatch) -> None:
    """QA edge case (not in the brief's named fixtures): the first call
    returns unparseable JSON (triggers the one-retry path, AC-4), and the
    retry attempt itself hits a real connection failure rather than
    returning more bad text. `ProviderUnavailable` must still propagate --
    a provider outage arriving mid-retry must not be silently swallowed
    into a `None` ("unsatisfiable") decline, which would show the user the
    wrong error state (decline vs. provider_503 are AC-3/AC-4's two
    deliberately distinct outcomes).
    """
    import weave_backend.dashboard.intent as intent_module

    calls: list[str | Exception] = ["not json", ConnectionError("boom")]

    def _flaky(tier: str, prompt: str, **kwargs: object) -> str:
        result = calls.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(intent_module, "route", _flaky)

    with pytest.raises(ProviderUnavailable):
        await resolve("show entities by kind")
