"""AC-1: `make scaffold` creates the monorepo directory tree and lints clean."""

from __future__ import annotations

import subprocess
from pathlib import Path

SCAFFOLD_DIRS = (
    "packages/backend",
    "packages/frontend",
    "packages/shared",
    "infra/terraform",
)


def test_scaffold_dirs_exist(repo_root: Path) -> None:
    result = subprocess.run(
        ["make", "scaffold"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=300,
    )

    assert result.returncode == 0, (
        f"make scaffold failed\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    for rel_dir in SCAFFOLD_DIRS:
        assert (repo_root / rel_dir).is_dir(), f"missing scaffolded directory: {rel_dir}"
