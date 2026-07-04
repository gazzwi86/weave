"""AC-1: the monorepo directory tree exists.

Originally shelled out to `make scaffold`, but that target runs `make lint`,
which lints the *frontend* (eslint/tsc) too -- unavailable in the backend-only
`api` CI job (no `npm ci`), so this test failed with `eslint: not found`.

The "lints clean" half of AC-1 is already enforced continuously and in the
right place by the dedicated CI jobs (ruff+mypy in `api`, eslint+tsc in `web`);
re-running it here from a backend job was both redundant and mis-placed. This
test now owns only the structural claim it can verify without a cross-stack
toolchain: the scaffolded directories exist.
"""

from __future__ import annotations

from pathlib import Path

SCAFFOLD_DIRS = (
    "packages/backend",
    "packages/frontend",
    "packages/shared",
    "infra/terraform",
)


def test_scaffold_dirs_exist(repo_root: Path) -> None:
    for rel_dir in SCAFFOLD_DIRS:
        assert (repo_root / rel_dir).is_dir(), f"missing scaffolded directory: {rel_dir}"
