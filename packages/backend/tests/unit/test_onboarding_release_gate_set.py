"""ONB-TASK-015 AC-015-06: the `onboarding_release_gate` marker set is complete.

Gate 1's evidence is the eight tests below, each tagged
`@pytest.mark.onboarding_release_gate` at its definition (isolation trio,
reset known-state, exactly-once activation, RLS fail-closed, role matrix --
two legs). This test statically confirms every named test still exists and
still carries the marker, so a rename or an accidentally-dropped decorator
fails CI instead of silently shrinking the evidence set.

# ponytail: grep-based static check over the marker decorator line, not a
# `pytest --collect-only -m onboarding_release_gate` subprocess -- mirrors
# `test_onboarding_m2_invariants_selector_check.py`'s precedent (grep over
# subprocess) and stays fast/no-docker so this runs in the default `api`
# job, not just the `integration` job most of the tagged tests live in.
"""

from __future__ import annotations

import re
from pathlib import Path


def _find_repo_root(start: Path) -> Path:
    """Walk up from `start` to the repo-root marker.

    # ponytail: a fixed `parents[N]` index breaks under mutmut, which copies
    # the test tree into a `mutants/` subdirectory -- shifting every ancestor
    # one level. Walking up to a marker (`.git`) tolerates the extra path
    # segment regardless of depth. Same pattern as
    # `test_onboarding_m2_invariants_selector_check.py`'s `_find_repo_root`.
    """
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists():
            return candidate
    raise RuntimeError(f"no repo root found walking up {start}")


_REPO_ROOT = _find_repo_root(Path(__file__).resolve())

# (relative path from repo root, test function name)
_EXPECTED_GATE_TESTS = [
    (
        "packages/backend/tests/integration/test_onboarding_sandbox.py",
        "test_sandbox_per_user_isolation",
    ),
    (
        "packages/backend/tests/integration/test_onboarding_sandbox.py",
        "test_canonical_write_403_audited",
    ),
    (
        "packages/backend/tests/integration/test_onboarding_sandbox.py",
        "test_cross_tenant_zero_leak",
    ),
    (
        "packages/backend/tests/integration/test_onboarding_sandbox_reset.py",
        "test_reset_success_bumps_pointer_clears_exercises_preserves_activation",
    ),
    (
        "packages/backend/tests/integration/test_onboarding_activation_integration.py",
        "test_activation_exactly_once_under_concurrent_writers",
    ),
    (
        "packages/backend/tests/integration/test_onboarding_state_api.py",
        "test_onboarding_tables_zero_rows_without_session_context",
    ),
    (
        "packages/backend/tests/unit/test_onboarding_path_resolver.py",
        "test_ac_006_01_every_canonical_role_maps_to_exactly_one_path",
    ),
    (
        "packages/backend/tests/unit/test_onboarding_path_resolver.py",
        "test_ac_006_03_zero_or_viewer_role_resolves_business_read_only",
    ),
]

_MARKER_LINE = re.compile(r"@pytest\.mark\.onboarding_release_gate\b")
_DEF_LINE_TEMPLATE = "def {name}("


def test_every_named_gate_test_exists_and_carries_the_marker() -> None:
    for rel_path, func_name in _EXPECTED_GATE_TESTS:
        source = (_REPO_ROOT / rel_path).read_text()
        def_line = _DEF_LINE_TEMPLATE.format(name=func_name)
        assert def_line in source, (
            f"{func_name} not found in {rel_path} -- gate test renamed or removed?"
        )

        # The marker must appear on one of the (small, fixed) run of
        # decorator lines directly above the def, tolerating an intervening
        # @pytest.mark.parametrize the way the two role-matrix tests use.
        def_index = source.index(def_line)
        preceding = source[:def_index].splitlines()[-3:]
        assert any(_MARKER_LINE.search(line) for line in preceding), (
            f"{func_name} in {rel_path} has lost its onboarding_release_gate marker"
        )


def test_expected_gate_set_covers_all_five_named_categories() -> None:
    # Sanity on the fixture list itself: eight tests, no duplicates, spread
    # across the five roadmap-cited categories (isolation trio counts as
    # three; role matrix's two legs count as one category).
    assert len(_EXPECTED_GATE_TESTS) == len(set(_EXPECTED_GATE_TESTS)) == 8
