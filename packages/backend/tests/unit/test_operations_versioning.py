"""CE-TASK-001 unit test: pure semver-bump helper (no DB needed)."""

from __future__ import annotations

from weave_backend.operations.versioning import _bump_patch


def test_bump_patch_increments_final_segment() -> None:
    assert _bump_patch("0.1.0") == "0.1.1"


def test_bump_patch_only_touches_the_patch_segment() -> None:
    assert _bump_patch("1.9.4") == "1.9.5"
