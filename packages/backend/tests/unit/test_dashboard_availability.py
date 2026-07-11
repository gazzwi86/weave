"""AC-6/AC-8: single-source Engine-Availability Registry (m2-delta.md §1) --
pure static lookup, no DB.
"""

from __future__ import annotations

from weave_backend.dashboard import availability


def test_ce_is_ga_others_are_not() -> None:
    assert availability.is_ga("ce") is True
    assert availability.is_ga("build") is False
    assert availability.is_ga("events") is False
    assert availability.is_ga("explorer") is False


def test_unknown_engine_defaults_to_not_ga() -> None:
    assert availability.is_ga("some-future-engine") is False


def test_source_available_true_only_when_every_contract_is_ga() -> None:
    assert availability.source_available(["CE-METRICS-1"]) is True
    assert availability.source_available(["CE-METRICS-1", "BUILD-RUNS-1"]) is False


def test_source_available_empty_list_is_vacuously_true() -> None:
    assert availability.source_available([]) is True
