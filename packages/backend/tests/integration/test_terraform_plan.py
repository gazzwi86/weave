"""AC-2 (plan): full module set plans cleanly; prod modules resolve to zero
resources when `deploy_prod_stack` is off, and to >0 when it's on.

Runs fully offline: dummy static credentials + the AWS provider's `skip_*`
escape hatches (the same trick used for LocalStack-backed provider testing)
avoid any real network call to AWS. Never runs `terraform apply` (Law F).
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(shutil.which("terraform") is None, reason="terraform not installed"),
]

PROD_GATED_MODULES = {"aurora_pg", "elasticache", "s3_assets", "s3_spa", "cloudfront", "vpc"}

_OFFLINE_ENV = {
    **os.environ,
    "AWS_ACCESS_KEY_ID": "test",
    "AWS_SECRET_ACCESS_KEY": "test",
    "AWS_REGION": "ap-southeast-2",
}


def _dev_dir(repo_root: Path) -> Path:
    return repo_root / "infra" / "terraform" / "environments" / "dev"


def _plan_module_addresses(env_dir: Path, tmp_path: Path, deploy_prod_stack: bool) -> set[str]:
    plan_file = tmp_path / f"plan-{deploy_prod_stack}.tfplan"
    plan = subprocess.run(
        [
            "terraform",
            "plan",
            "-input=false",
            "-var-file=dev.tfvars",
            "-var=offline_test=true",
            f"-var=deploy_prod_stack={'true' if deploy_prod_stack else 'false'}",
            f"-out={plan_file}",
        ],
        cwd=env_dir,
        capture_output=True,
        text=True,
        timeout=300,
        env=_OFFLINE_ENV,
    )
    assert plan.returncode == 0, f"terraform plan failed\n{plan.stdout}\n{plan.stderr}"

    show = subprocess.run(
        ["terraform", "show", "-json", str(plan_file)],
        cwd=env_dir,
        capture_output=True,
        text=True,
        timeout=60,
        env=_OFFLINE_ENV,
    )
    assert show.returncode == 0, show.stderr

    plan_json = json.loads(show.stdout)
    addresses = {
        change["address"] for change in plan_json.get("resource_changes", [])
    }
    return addresses


def test_terraform_plan_dev_completes(repo_root: Path, tmp_path: Path) -> None:
    env_dir = _dev_dir(repo_root)
    init = subprocess.run(
        ["terraform", "init", "-backend=false", "-input=false"],
        cwd=env_dir,
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert init.returncode == 0, f"{init.stdout}\n{init.stderr}"

    off_addresses = _plan_module_addresses(env_dir, tmp_path, deploy_prod_stack=False)
    assert not any(
        addr.startswith(f"module.{mod}") for addr in off_addresses for mod in PROD_GATED_MODULES
    ), f"prod-gated resources present when deploy_prod_stack=false: {off_addresses}"

    on_addresses = _plan_module_addresses(env_dir, tmp_path, deploy_prod_stack=True)
    assert any(
        addr.startswith(f"module.{mod}") for addr in on_addresses for mod in PROD_GATED_MODULES
    ), "expected prod-gated resources when deploy_prod_stack=true"
