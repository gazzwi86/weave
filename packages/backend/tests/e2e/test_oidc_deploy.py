"""AC-5: static workflow assertion for the OIDC-based essential-dev deploy.

Real end-to-end verification (a genuine OIDC token exchange + terraform apply)
only happens once `vars.DEPLOY_ROLE_ARN` is bootstrapped by a human and this
runs for real on a push to main — see the task summary for the deferral note.
This test asserts the *shape* required for that to be safe: no stored AWS
keys anywhere in the workflows directory, OIDC permissions present, the role
comes from a repo variable (not a secret), and the apply is essential-only.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, cast

import pytest
import yaml

pytestmark = pytest.mark.e2e

FORBIDDEN_KEY_PATTERNS = (
    re.compile(r"aws-access-key-id\s*:\s*[\"']?\$\{\{\s*secrets\."),
    re.compile(r"aws-secret-access-key\s*:\s*[\"']?\$\{\{\s*secrets\."),
    re.compile(r"AKIA[0-9A-Z]{16}"),
)


def _load_workflow(repo_root: Path) -> dict[str, Any]:
    text = (repo_root / ".github" / "workflows" / "ci.yml").read_text()
    return cast(dict[str, Any], yaml.safe_load(text))


def test_oidc_deploy_essential_dev(repo_root: Path) -> None:
    workflows_dir = repo_root / ".github" / "workflows"
    for wf_file in workflows_dir.glob("*.yml"):
        text = wf_file.read_text()
        for pattern in FORBIDDEN_KEY_PATTERNS:
            assert not pattern.search(text), (
                f"stored/hardcoded AWS credential shape found in {wf_file}"
            )

    workflow = _load_workflow(repo_root)
    deploy = workflow["jobs"]["deploy-essential-dev"]

    permissions = deploy.get("permissions", {})
    assert permissions.get("id-token") == "write"
    assert permissions.get("contents") == "read"

    assert deploy.get("if", "").strip() == "github.ref == 'refs/heads/main'"

    needs = deploy.get("needs", [])
    if isinstance(needs, str):
        needs = [needs]
    assert {"api", "web", "mutation", "secrets"}.issubset(set(needs)), (
        "deploy must be gated behind all quality jobs"
    )

    step_texts = [str(s.get("uses", "")) + " " + str(s.get("run", "")) for s in deploy["steps"]]
    joined = "\n".join(step_texts)

    assert "aws-actions/configure-aws-credentials" in joined
    assert "vars.DEPLOY_ROLE_ARN" in joined
    assert "secrets.AWS_ACCESS_KEY_ID" not in joined
    assert "secrets.AWS_SECRET_ACCESS_KEY" not in joined
    assert "-var deploy_prod_stack=false" in joined or "-var=deploy_prod_stack=false" in joined

    # Guarded so it no-ops until DEPLOY_ROLE_ARN is bootstrapped by a human (HITL).
    guard_texts = [str(s.get("if", "")) for s in deploy["steps"]] + [str(deploy.get("if", ""))]
    assert any("DEPLOY_ROLE_ARN" in g for g in guard_texts)


def test_oidc_deploy_every_aws_step_individually_guarded(repo_root: Path) -> None:
    """Edge case: `any(...)` above only proves *one* step is guarded.

    That would still pass if e.g. the credentials step kept its guard but the
    `terraform apply` step lost its own — the money/security-sensitive step is
    the one that actually must never run un-gated. Assert each AWS-touching
    step (credentials, init, plan, apply) carries its own guard.
    """
    workflow = _load_workflow(repo_root)
    deploy = workflow["jobs"]["deploy-essential-dev"]

    aws_touching_needles = (
        "aws-actions/configure-aws-credentials",
        "terraform init",
        "terraform plan",
        "terraform apply",
    )

    for step in deploy["steps"]:
        step_text = str(step.get("uses", "")) + " " + str(step.get("run", ""))
        if any(needle in step_text for needle in aws_touching_needles):
            assert "DEPLOY_ROLE_ARN" in str(step.get("if", "")), (
                f"AWS-touching step must carry its own DEPLOY_ROLE_ARN guard: {step}"
            )
