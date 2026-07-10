"""AC-8 (TASK-011): role-tailored example prompts, scoped to GA categories
only -- the availability registry (`dashboard/availability.py`) is the
single GA source (m2-delta.md §3), never a second hand-copied map.
"""

from __future__ import annotations

from weave_backend.dashboard.example_prompts import (
    EXAMPLE_PROMPTS_HIDE_AFTER,
    example_prompts_for_role,
)


def test_example_prompts_scoped_to_ga() -> None:
    """Every role's catalogue over-provisions with at least one non-GA
    (Build-engine) prompt -- proves the GA filter actually removes it,
    not just an all-GA fixture that happens to pass.
    """
    for role in ("read", "author", "publish"):
        prompts = example_prompts_for_role(role)
        assert 4 <= len(prompts) <= 6
        assert not any("build" in prompt.lower() for prompt in prompts)


def test_unknown_role_falls_back_to_default() -> None:
    assert example_prompts_for_role("bogus-role") == example_prompts_for_role("read")


def test_hide_after_constant_is_three() -> None:
    assert EXAMPLE_PROMPTS_HIDE_AFTER == 3
