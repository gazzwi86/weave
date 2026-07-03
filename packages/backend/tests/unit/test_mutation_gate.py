"""AC-3: mutation score gate (>=70%) computed from mutmut's cicd-stats JSON."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from weave_backend.scripts.mutation_gate import evaluate, main


def test_evaluate_passes_above_threshold() -> None:
    score, passed = evaluate({"killed": 8, "survived": 2, "total": 10})
    assert score == pytest.approx(80.0)
    assert passed is True


def test_evaluate_fails_below_threshold() -> None:
    score, passed = evaluate({"killed": 5, "survived": 5, "total": 10})
    assert score == pytest.approx(50.0)
    assert passed is False


def test_evaluate_no_mutants_checked_passes_structurally() -> None:
    # Nothing was killed or survived (e.g. codebase too small to have coverable
    # mutants yet) — the gate must not false-fail while there is nothing to grade.
    score, passed = evaluate({"killed": 0, "survived": 0, "total": 8})
    assert score is None
    assert passed is True


def _write_stats(tmp_path: Path, stats: dict[str, int]) -> str:
    stats_path = tmp_path / "mutmut-cicd-stats.json"
    stats_path.write_text(json.dumps(stats))
    return str(stats_path)


def test_main_returns_zero_when_score_meets_threshold(tmp_path: Path) -> None:
    stats_path = _write_stats(tmp_path, {"killed": 8, "survived": 2, "total": 10})
    assert main(stats_path) == 0


def test_main_returns_one_when_score_below_threshold(tmp_path: Path) -> None:
    stats_path = _write_stats(tmp_path, {"killed": 5, "survived": 5, "total": 10})
    assert main(stats_path) == 1


def test_main_returns_zero_when_nothing_checked_yet(tmp_path: Path) -> None:
    stats_path = _write_stats(tmp_path, {"killed": 0, "survived": 0, "total": 0})
    assert main(stats_path) == 0
