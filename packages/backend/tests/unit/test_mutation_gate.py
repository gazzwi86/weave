"""AC-3: mutation score gate (>=70%) computed from mutmut's cicd-stats JSON."""

from __future__ import annotations

import pytest
from weave_backend.scripts.mutation_gate import evaluate


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
