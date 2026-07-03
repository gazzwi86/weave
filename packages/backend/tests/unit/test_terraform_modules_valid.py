"""AC-2: `terraform validate` passes for the full module set, per environment.

No credentials or network calls to AWS are required for `validate` — it only checks
config syntax/schema against the provider, so this is safe to run as a fast unit test.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(shutil.which("terraform") is None, reason="terraform not installed")


def _environment_dirs(repo_root: Path) -> list[Path]:
    envs_root = repo_root / "infra" / "terraform" / "environments"
    return sorted(d for d in envs_root.iterdir() if d.is_dir() and any(d.glob("*.tf")))


def test_terraform_modules_valid(repo_root: Path) -> None:
    env_dirs = _environment_dirs(repo_root)
    assert env_dirs, "expected at least one terraform environment with .tf files"

    for env_dir in env_dirs:
        init = subprocess.run(
            ["terraform", "init", "-backend=false", "-input=false"],
            cwd=env_dir,
            capture_output=True,
            text=True,
            timeout=300,
        )
        assert init.returncode == 0, (
            f"terraform init failed for {env_dir}\n{init.stdout}\n{init.stderr}"
        )

        validate = subprocess.run(
            ["terraform", "validate"],
            cwd=env_dir,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert validate.returncode == 0, (
            f"terraform validate failed for {env_dir}\n{validate.stdout}\n{validate.stderr}"
        )
