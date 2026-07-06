"""BE-TASK-008 (build-engine EPIC-008): the 5 M1 safety gates (AC-3, AC-5,
AC-7). Law F: `subprocess.run` (bandit/semgrep/mypy/tsc/mutmut) is mocked at
this module's boundary -- never a real external-tool invocation.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from weave_backend.generation.gates import (
    GateFailure,
    find_unconfirmed_model_ids,
    run_mutation_gate,
    run_package_existence_gate,
    run_sast_gate,
    run_secret_scan_gate,
    run_type_check_gate,
)


def _completed(returncode: int, *, stdout: str = "", stderr: str = "") -> object:
    class _Result:
        pass

    result = _Result()
    result.returncode = returncode  # type: ignore[attr-defined]
    result.stdout = stdout  # type: ignore[attr-defined]
    result.stderr = stderr  # type: ignore[attr-defined]
    return result


def test_run_secret_scan_gate_passes_on_clean_workspace(tmp_path: Path) -> None:
    (tmp_path / "app.py").write_text("print('hello')\n")

    result = run_secret_scan_gate(str(tmp_path))

    assert result.gate == "secret_scan"
    assert result.status == "PASS"


def test_run_secret_scan_gate_raises_secret_scan_fail_with_hits(tmp_path: Path) -> None:
    quote = "'"
    line = "api" + "_key" + " = " + quote + "abcdefgh12345678" + quote
    (tmp_path / "config.py").write_text(line + "\n")

    with pytest.raises(GateFailure) as exc_info:
        run_secret_scan_gate(str(tmp_path))

    assert exc_info.value.error == "secret_scan_fail"
    hits = exc_info.value.evidence["hits"]
    assert isinstance(hits, list)
    assert len(hits) == 1


def test_run_sast_gate_raises_sast_fail_when_bandit_exits_non_zero(tmp_path: Path) -> None:
    with patch("weave_backend.generation.gates.subprocess.run") as mock_run:
        mock_run.side_effect = [
            _completed(1, stderr="B608: possible SQL injection"),
            _completed(0),
        ]

        with pytest.raises(GateFailure) as exc_info:
            run_sast_gate(str(tmp_path))

    assert exc_info.value.error == "sast_fail"
    evidence = exc_info.value.evidence["evidence"]
    assert isinstance(evidence, str)
    assert "SQL injection" in evidence


def test_run_sast_gate_raises_sast_fail_when_semgrep_exits_non_zero(tmp_path: Path) -> None:
    with patch("weave_backend.generation.gates.subprocess.run") as mock_run:
        mock_run.side_effect = [_completed(0), _completed(1, stderr="rule violation")]

        with pytest.raises(GateFailure) as exc_info:
            run_sast_gate(str(tmp_path))

    assert exc_info.value.error == "sast_fail"


def test_run_sast_gate_passes_when_both_tools_exit_zero(tmp_path: Path) -> None:
    with patch("weave_backend.generation.gates.subprocess.run") as mock_run:
        mock_run.side_effect = [_completed(0), _completed(0)]

        result = run_sast_gate(str(tmp_path))

    assert result.gate == "sast"
    assert result.status == "PASS"


def test_find_unconfirmed_model_ids_flags_invented_model_id(tmp_path: Path) -> None:
    (tmp_path / "client.py").write_text('MODEL = "claude-4-opus"\n')

    assert find_unconfirmed_model_ids(str(tmp_path)) == ["claude-4-opus"]


def test_find_unconfirmed_model_ids_accepts_confirmed_model_ids(tmp_path: Path) -> None:
    (tmp_path / "client.py").write_text('MODEL = "claude-sonnet-5"\n')

    assert find_unconfirmed_model_ids(str(tmp_path)) == []


def test_run_sast_gate_raises_sast_fail_on_unconfirmed_model_id(tmp_path: Path) -> None:
    (tmp_path / "client.py").write_text('MODEL = "claude-4-opus"\n')
    with patch("weave_backend.generation.gates.subprocess.run") as mock_run:
        mock_run.side_effect = [_completed(0), _completed(0)]

        with pytest.raises(GateFailure) as exc_info:
            run_sast_gate(str(tmp_path))

    assert exc_info.value.error == "sast_fail"
    evidence = exc_info.value.evidence["evidence"]
    assert isinstance(evidence, str)
    assert "claude-4-opus" in evidence


def test_run_type_check_gate_raises_type_check_fail_when_mypy_exits_non_zero(
    tmp_path: Path,
) -> None:
    with patch("weave_backend.generation.gates.subprocess.run") as mock_run:
        mock_run.side_effect = [_completed(1, stderr="error: Incompatible types"), _completed(0)]

        with pytest.raises(GateFailure) as exc_info:
            run_type_check_gate(str(tmp_path))

    assert exc_info.value.error == "type_check_fail"


def test_run_package_existence_gate_raises_when_import_unresolved(tmp_path: Path) -> None:
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / "main.py").write_text("import some_ghost_package\n")

    with pytest.raises(GateFailure) as exc_info:
        run_package_existence_gate(str(tmp_path))

    assert exc_info.value.error == "package_existence_fail"


def test_run_mutation_gate_raises_mutation_gate_fail_when_score_below_threshold(
    tmp_path: Path,
) -> None:
    stats = {"killed": 65, "survived": 35, "survivors": [{"mutant": "m1", "line": 12}]}
    with patch("weave_backend.generation.gates.subprocess.run") as mock_run:
        mock_run.return_value = _completed(0, stdout=json.dumps(stats))

        with pytest.raises(GateFailure) as exc_info:
            run_mutation_gate(str(tmp_path))

    assert exc_info.value.error == "mutation_gate_fail"
    assert exc_info.value.evidence["score"] == pytest.approx(0.65)
    assert exc_info.value.evidence["surviving_mutants"] == stats["survivors"]


def test_run_mutation_gate_passes_when_score_at_or_above_threshold(tmp_path: Path) -> None:
    stats = {"killed": 75, "survived": 25, "survivors": []}
    with patch("weave_backend.generation.gates.subprocess.run") as mock_run:
        mock_run.return_value = _completed(0, stdout=json.dumps(stats))

        result = run_mutation_gate(str(tmp_path))

    assert result.gate == "mutation"
    assert result.score == pytest.approx(0.75)
