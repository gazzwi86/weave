"""AC-7: spike-mode write-back guard (BE-TASK-005, build-engine EPIC-006).

Reusable, unwired guard: no `/api/operations/apply` route (CE-WRITE-1)
exists yet in this codebase for it to gate (see task brief) -- the future
route calls this before any outbound write-back call, per the
implementation hint to check `task.run_mode` server-side rather than
trust caller-supplied tagging.
"""

from __future__ import annotations


class SpikeWriteBackForbidden(Exception):
    """Raised when a `spike`-mode run attempts a protected-branch write-back."""


def assert_not_spike_write_back(run_mode: str) -> None:
    """AC-7: raise `SpikeWriteBackForbidden` when `run_mode` is `"spike"`;
    a no-op for every other run mode.
    """
    if run_mode == "spike":
        raise SpikeWriteBackForbidden("spike-mode runs may not write back to protected branches")
