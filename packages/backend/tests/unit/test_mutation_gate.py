"""AC-3: mutation score gate (>=70%) computed from mutmut's cicd-stats JSON."""

from __future__ import annotations

import json
import subprocess
import sys
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


def test_evaluate_missing_keys_default_to_zero() -> None:
    # No "killed"/"survived" keys at all behaves like 0/0 -- passes structurally.
    score, passed = evaluate({})
    assert score is None
    assert passed is True


def test_evaluate_at_exact_threshold_passes() -> None:
    # Boundary: score == threshold must still pass (the gate is >=, not >).
    score, passed = evaluate({"killed": 7, "survived": 3}, threshold=70.0)
    assert score == pytest.approx(70.0)
    assert passed is True


def test_evaluate_just_below_threshold_fails() -> None:
    score, passed = evaluate({"killed": 69, "survived": 31}, threshold=70.0)
    assert score == pytest.approx(69.0)
    assert passed is False


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


def test_main_prints_score_and_threshold(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    stats_path = _write_stats(tmp_path, {"killed": 8, "survived": 2, "total": 10})
    main(stats_path)
    out = capsys.readouterr().out
    assert "mutation score: 80.0%" in out
    assert "threshold 70%" in out


def test_main_prints_structural_pass_message(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    stats_path = _write_stats(tmp_path, {"killed": 0, "survived": 0, "total": 0})
    main(stats_path)
    out = capsys.readouterr().out
    assert "no mutants exercised yet" in out
    assert "passing structurally" in out


def test_cli_invocation_matches_ci_usage(tmp_path: Path) -> None:
    """Edge case: covers the `if __name__ == "__main__":` block itself.

    Every other test here calls `main()` directly — none of them exercise the
    `python -m weave_backend.scripts.mutation_gate <path>` invocation that
    `ci.yml`'s mutation job actually runs. Runs the module as a real
    subprocess, the exact way CI does, so a broken argv/entrypoint wiring
    would fail here even though every direct `main()` call still passes.
    """
    stats_path = _write_stats(tmp_path, {"killed": 5, "survived": 5, "total": 10})
    result = subprocess.run(
        [sys.executable, "-m", "weave_backend.scripts.mutation_gate", stats_path],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 1, result.stdout + result.stderr
    assert "mutation score: 50.0%" in result.stdout
