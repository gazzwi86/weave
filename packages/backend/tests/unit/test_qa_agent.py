"""BE-TASK-007 unit tests: `qa_agent.run_command` actually shells out (no
simulated result) -- a missing binary is `NOT_VERIFIED`, a non-zero exit is
`FAIL`, a zero exit is `PASS`. `true`/`false` are portable coreutils
binaries present on both macOS and the Linux CI image -- no fixture script
needed.
"""

from __future__ import annotations

import subprocess
from unittest.mock import patch

from weave_backend.build.qa_agent import run_command


def test_run_command_pass_on_zero_exit() -> None:
    outcome = run_command("true")

    assert outcome.status == "PASS"


def test_run_command_fail_on_nonzero_exit() -> None:
    outcome = run_command("false")

    assert outcome.status == "FAIL"


def test_run_command_marks_not_verified_when_binary_not_found() -> None:
    outcome = run_command("definitely-not-a-real-binary-xyz")

    assert outcome.status == "NOT_VERIFIED"


def test_run_command_truncates_stderr_evidence_to_500_chars() -> None:
    long_stderr = "e" * 600
    fake_result = subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr=long_stderr)

    with patch("weave_backend.build.qa_agent.subprocess.run", return_value=fake_result):
        outcome = run_command("some-lint-command")

    assert outcome.status == "FAIL"
    assert len(outcome.evidence) == 500
