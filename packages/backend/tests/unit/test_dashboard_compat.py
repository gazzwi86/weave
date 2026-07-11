"""Regression test for the mutmut-staging path bug (2026-07-12): `COMPAT_PATH`
must resolve `packages/shared/widget-compat.json` regardless of how many extra
directory levels sit between the module file and the repo root -- mutmut runs
tests from a copied `packages/backend/mutants/...` tree, which adds one extra
level versus the real `packages/backend/...` tree. A hardcoded `parents[N]`
climb breaks under that extra nesting; the fix must not.
"""

from __future__ import annotations

from pathlib import Path

from weave_backend.dashboard.compat import COMPAT_PATH, _find_shared_dir


def test_compat_path_resolves_to_real_shared_file() -> None:
    assert COMPAT_PATH.exists()
    assert COMPAT_PATH.name == "widget-compat.json"


def test_find_shared_dir_is_independent_of_extra_nesting(tmp_path: Path) -> None:
    # Simulate mutmut's staging copy: an extra "mutants" directory inserted
    # between "backend" and "src".
    real_root = tmp_path / "weave" / "packages"
    (real_root / "shared").mkdir(parents=True)
    (real_root / "shared" / "widget-compat.json").write_text("{}")

    module_parts = ("weave_backend", "dashboard", "compat.py")
    normal_file = real_root.joinpath("backend", "src", *module_parts)
    staged_file = real_root.joinpath("backend", "mutants", "src", *module_parts)

    assert _find_shared_dir(normal_file) == real_root / "shared"
    assert _find_shared_dir(staged_file) == real_root / "shared"
