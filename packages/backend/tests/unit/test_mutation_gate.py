"""AC-3: mutation score gate (>=60%) computed from mutmut's cicd-stats JSON."""

from __future__ import annotations

import json
import os
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


def test_evaluate_no_mutants_at_all_passes_structurally() -> None:
    # total == 0: genuinely nothing to mutate yet — nothing to grade.
    score, passed = evaluate({"killed": 0, "survived": 0, "total": 0})
    assert score is None
    assert passed is True


def test_evaluate_interrupted_run_fails() -> None:
    # Mutants exist (total > 0) but none were killed or survived — the mutmut
    # run itself was interrupted/timed out, not "nothing to grade". Must fail
    # loudly instead of silently passing on the same 0/0 shape.
    score, passed = evaluate({"killed": 0, "survived": 0, "total": 8})
    assert score is None
    assert passed is False


def test_evaluate_missing_keys_default_to_zero() -> None:
    # No keys at all -> total defaults to 0 -- passes structurally.
    score, passed = evaluate({})
    assert score is None
    assert passed is True


def test_evaluate_at_exact_threshold_passes() -> None:
    # Boundary: score == threshold must still pass (the gate is >=, not >).
    score, passed = evaluate({"killed": 7, "survived": 3, "total": 10}, threshold=70.0)
    assert score == pytest.approx(70.0)
    assert passed is True


def test_evaluate_just_below_threshold_fails() -> None:
    score, passed = evaluate({"killed": 69, "survived": 31, "total": 100}, threshold=70.0)
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


def test_main_returns_zero_when_nothing_to_mutate_yet(tmp_path: Path) -> None:
    stats_path = _write_stats(tmp_path, {"killed": 0, "survived": 0, "total": 0})
    assert main(stats_path) == 0


def test_main_returns_one_when_run_was_interrupted(tmp_path: Path) -> None:
    stats_path = _write_stats(tmp_path, {"killed": 0, "survived": 0, "total": 8})
    assert main(stats_path) == 1


def test_main_prints_score_and_threshold(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    # Default (no env): the strict phase-gate threshold applies. delenv makes this
    # deterministic even when the ambient env sets a per-PR floor (e.g. the CI
    # mutation job that runs this suite as its mutmut baseline).
    monkeypatch.delenv("MUTATION_SCORE_THRESHOLD", raising=False)
    stats_path = _write_stats(tmp_path, {"killed": 8, "survived": 2, "total": 10})
    main(stats_path)
    out = capsys.readouterr().out
    assert "mutation score: 80.0%" in out
    assert "threshold 60%" in out


def test_main_honours_env_threshold_override(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    # CI sets no override (one 60% bar via the default), but the env mechanism is
    # still available to callers — prove it changes the effective bar with a value
    # distinct from the 60 default: 65% passes 60 but fails an overridden 80.
    monkeypatch.setenv("MUTATION_SCORE_THRESHOLD", "80")
    stats_path = _write_stats(tmp_path, {"killed": 65, "survived": 35, "total": 100})
    assert main(stats_path) == 1
    out = capsys.readouterr().out
    assert "mutation score: 65.0%" in out
    assert "threshold 80%" in out


def test_main_prints_structural_pass_message(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    stats_path = _write_stats(tmp_path, {"killed": 0, "survived": 0, "total": 0})
    main(stats_path)
    out = capsys.readouterr().out
    assert "no mutants to exercise yet" in out
    assert "passing structurally" in out


def test_main_prints_interrupted_failure_message(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    stats_path = _write_stats(tmp_path, {"killed": 0, "survived": 0, "total": 8})
    main(stats_path)
    out = capsys.readouterr().out
    assert "FAIL" in out
    assert "8 mutants exist" in out


def test_cli_invocation_matches_ci_usage(tmp_path: Path) -> None:
    """Edge case: covers the `if __name__ == "__main__":` block itself.

    Every other test here calls `main()` directly — none of them exercise the
    `python -m weave_backend.scripts.mutation_gate <path>` invocation that
    `ci.yml`'s mutation job actually runs. Runs the module as a real
    subprocess, the exact way CI does, so a broken argv/entrypoint wiring
    would fail here even though every direct `main()` call still passes.
    """
    stats_path = _write_stats(tmp_path, {"killed": 5, "survived": 5, "total": 10})
    # Cleaned env: strip any ambient override so this asserts the 60% default
    # deterministically — 50% must fail regardless of the caller's env.
    clean_env = {k: v for k, v in os.environ.items() if k != "MUTATION_SCORE_THRESHOLD"}
    result = subprocess.run(
        [sys.executable, "-m", "weave_backend.scripts.mutation_gate", stats_path],
        capture_output=True,
        text=True,
        timeout=30,
        env=clean_env,
    )
    assert result.returncode == 1, result.stdout + result.stderr
    assert "mutation score: 50.0%" in result.stdout
