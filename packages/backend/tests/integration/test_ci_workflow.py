"""AC-3/AC-4: static structural assertions on the CI workflow.

These cannot execute the actual GitHub Actions runner in this environment, so
they parse `.github/workflows/ci.yml` and assert the required jobs/gates exist
and are wired correctly (no `continue-on-error` on blocking gates, quality
jobs present, etc). Live behaviour (annotations on PR checks, merge blocking)
is verified for real on the first PR/push once this lands — see the task
summary for the deferral note.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import pytest
import yaml

pytestmark = pytest.mark.integration

REQUIRED_QUALITY_JOBS = {"api", "web", "mutation", "secrets"}
LINT_STEP_NEEDLES = ("ruff check", "mypy", "npm run lint", "npm run typecheck")


def _load_workflow(repo_root: Path) -> dict[str, Any]:
    ci_path = repo_root / ".github" / "workflows" / "ci.yml"
    return cast(dict[str, Any], yaml.safe_load(ci_path.read_text()))


def _step_texts(job: dict[str, Any]) -> list[str]:
    texts = []
    for step in job.get("steps", []):
        texts.append(str(step.get("run", "")))
        texts.append(str(step.get("uses", "")))
    return texts


def test_ci_pr_gates_pass(repo_root: Path) -> None:
    workflow = _load_workflow(repo_root)
    jobs = workflow["jobs"]

    missing = REQUIRED_QUALITY_JOBS - jobs.keys()
    assert not missing, f"CI is missing required quality-gate jobs: {missing}"

    for job_name in ("api", "web", "mutation", "secrets"):
        assert jobs[job_name].get("timeout-minutes", 999) <= 10, (
            f"{job_name} job must report within the 10-minute PR-check budget"
        )

    mutation_texts = " ".join(_step_texts(jobs["mutation"]))
    assert "mutmut" in mutation_texts, "mutation job must actually run mutmut"
    assert "70" in mutation_texts, "mutation job must enforce the 70% threshold"

    secrets_texts = " ".join(_step_texts(jobs["secrets"]))
    assert "gitleaks" in secrets_texts, "secrets job must run gitleaks"


def test_ci_lint_failure_blocks_merge(repo_root: Path) -> None:
    workflow = _load_workflow(repo_root)
    jobs = workflow["jobs"]

    for job_name in ("api", "web"):
        for step in jobs[job_name].get("steps", []):
            run_line = str(step.get("run", ""))
            if any(needle in run_line for needle in LINT_STEP_NEEDLES):
                assert step.get("continue-on-error") is not True, (
                    f"lint/type-check step in {job_name} must block on failure: {step}"
                )
