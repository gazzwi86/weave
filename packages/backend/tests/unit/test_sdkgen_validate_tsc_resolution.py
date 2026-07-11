"""CI-fix regression test -- ``_resolve_tsc``'s repo-root search must not be
thrown off by an extra nesting level (e.g. mutmut's ``mutants/`` staging
copy: ``packages/backend/mutants/src/weave_backend/sdkgen/validate.py``
instead of ``packages/backend/src/weave_backend/sdkgen/validate.py``). A
fixed ``../../../../frontend`` hop-count landed on
``packages/backend/frontend`` under that extra nesting -- this test pins the
walk-up-to-``packages/frontend``+``packages/backend`` search instead.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from weave_backend.sdkgen.validate import _find_repo_root


def _make_repo_root(tmp_path: Path) -> Path:
    (tmp_path / "packages" / "frontend" / "node_modules" / ".bin").mkdir(parents=True)
    (tmp_path / "packages" / "backend").mkdir(parents=True)
    return tmp_path


def test_find_repo_root_from_normal_source_layout(tmp_path: Path) -> None:
    repo_root = _make_repo_root(tmp_path)
    start = repo_root / "packages" / "backend" / "src" / "weave_backend" / "sdkgen"
    start.mkdir(parents=True)

    assert _find_repo_root(start) == repo_root


def test_find_repo_root_survives_extra_mutmut_nesting(tmp_path: Path) -> None:
    """The exact bug: mutmut copies mutated sources one level deeper, under
    ``mutants/``, before running tests against them.
    """
    repo_root = _make_repo_root(tmp_path)
    start = (
        repo_root / "packages" / "backend" / "mutants" / "src" / "weave_backend" / "sdkgen"
    )
    start.mkdir(parents=True)

    assert _find_repo_root(start) == repo_root


def test_find_repo_root_raises_when_no_packages_dir_found(tmp_path: Path) -> None:
    start = tmp_path / "somewhere" / "unrelated"
    start.mkdir(parents=True)

    with pytest.raises(FileNotFoundError):
        _find_repo_root(start)
