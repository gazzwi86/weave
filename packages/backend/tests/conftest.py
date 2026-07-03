"""Shared fixtures for the platform-scaffold + IaC test suite (TASK PLAT-TASK-001)."""

from __future__ import annotations

from pathlib import Path

import pytest


def _find_repo_root(start: Path) -> Path:
    """Walk up from ``start`` until a directory containing ``.git`` is found."""
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists():
            return candidate
    raise RuntimeError("could not locate repo root (no .git ancestor)")


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return _find_repo_root(Path(__file__).resolve())
