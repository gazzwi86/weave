"""AC-7: spike-mode write-back guard (BE-TASK-005, build-engine EPIC-006).

No `/api/operations/apply` route exists yet in this codebase (see task
brief) -- this is the reusable, unwired guard the future route will call.
"""

from __future__ import annotations

import pytest

from weave_backend.build.guards import SpikeWriteBackForbidden, assert_not_spike_write_back


def test_spike_mode_blocks_write_back() -> None:
    with pytest.raises(SpikeWriteBackForbidden):
        assert_not_spike_write_back("spike")


@pytest.mark.parametrize("run_mode", ["normal", "supervised"])
def test_non_spike_modes_allow_write_back(run_mode: str) -> None:
    assert_not_spike_write_back(run_mode)  # raises if violated
