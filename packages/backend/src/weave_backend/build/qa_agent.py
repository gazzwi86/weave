"""BE-TASK-007 (build-engine EPIC-012): the DoD gate's own command runner.

Design Decisions: the QA agent actually shells out -- no simulated/mocked
command result is ever substituted for a real exit code (FR-047). A
missing binary (`FileNotFoundError`) is `NOT_VERIFIED`, never skipped --
`run_dod_gate` treats `NOT_VERIFIED` as a failing command, same as a
non-zero exit code.
"""

from __future__ import annotations

import shlex
import subprocess
from dataclasses import dataclass

_EVIDENCE_TRUNCATE_CHARS = 500


@dataclass(frozen=True)
class CommandOutcome:
    status: str  # "PASS" | "FAIL" | "NOT_VERIFIED"
    evidence: str = ""


def run_command(cmd: str) -> CommandOutcome:
    """Runs `cmd` via `subprocess.run` (not `.call` -- Implementation Hints)
    with `capture_output=True` so a failing command's stderr is available
    for the audit `evidence` field, truncated to 500 chars.
    """
    try:
        result = subprocess.run(  # noqa: S603 -- cmd is a fixed DoD command, not user input
            shlex.split(cmd), capture_output=True, text=True, check=False
        )
    except FileNotFoundError as exc:
        return CommandOutcome(status="NOT_VERIFIED", evidence=str(exc)[:_EVIDENCE_TRUNCATE_CHARS])
    if result.returncode == 0:
        return CommandOutcome(status="PASS")
    return CommandOutcome(status="FAIL", evidence=result.stderr[:_EVIDENCE_TRUNCATE_CHARS])
