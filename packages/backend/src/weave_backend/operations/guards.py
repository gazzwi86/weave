"""XT-002: spike-mode write-back guard.

Vendored copy of `build/guards.py::assert_not_spike_write_back`
(BE-TASK-005, `feature/BE-EPIC-006`). That branch is unmerged and
unreachable from `feature/CE-EPIC-010` at the time CE-WRITE-1's
`POST /api/operations/apply` needed this check wired in -- see ADR-003 for
the full reasoning and the follow-up to dedupe once both branches land on
`main`.
"""

from __future__ import annotations


class SpikeWriteBackForbidden(Exception):
    """Raised when a `spike`-mode run attempts a protected-branch write-back."""


def assert_not_spike_write_back(run_mode: str) -> None:
    """Raise `SpikeWriteBackForbidden` when `run_mode` is `"spike"`; a no-op
    for every other run mode.
    """
    if run_mode == "spike":
        raise SpikeWriteBackForbidden("spike-mode runs may not write back to protected branches")
