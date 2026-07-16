"""AC-002-06: static structural assertions on `.github/workflows/hammerbarn-seed.yml`.

Same "parse the YAML, assert the gate/trigger shape" pattern as
`test_ci_workflow.py` -- the actual GitHub Actions runner (environment
approval, repository_dispatch delivery) can't execute in this environment, so
this is the "Static ... asserted by a lint test" row in TASK-002's Test
Requirements table, not a live exercise of the gate.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import pytest
import yaml

pytestmark = pytest.mark.integration


def _load_workflow(repo_root: Path) -> dict[Any, Any]:
    path = repo_root / ".github" / "workflows" / "hammerbarn-seed.yml"
    return cast(dict[Any, Any], yaml.safe_load(path.read_text()))


def _step_texts(job: dict[str, Any]) -> list[str]:
    texts = []
    for step in job.get("steps", []):
        texts.append(str(step.get("run", "")))
        texts.append(str(step.get("uses", "")))
    return texts


def test_triggers_are_manual_dispatch_or_ce_version_bump_event(repo_root: Path) -> None:
    workflow = _load_workflow(repo_root)
    # PyYAML parses the bare `on:` key as boolean `True`, not the string "on".
    triggers = workflow[True]

    assert "workflow_dispatch" in triggers
    assert "repository_dispatch" in triggers
    assert "ce-ontology-version-bump" in triggers["repository_dispatch"]["types"]


def test_apply_job_requires_hitl_environment_gate(repo_root: Path) -> None:
    """AC-002-06: no apply against a canonical target without the environment
    approval gate (content admin + Tech Lead, configured as required
    reviewers on the GitHub environment itself -- repo-settings state this
    test cannot see, only that the job references the gated environment)."""
    workflow = _load_workflow(repo_root)
    jobs = workflow["jobs"]

    assert "apply" in jobs, "workflow must have a gated apply job"
    apply_job = jobs["apply"]
    assert apply_job.get("environment"), "apply job must require a GitHub environment (HITL gate)"


def test_apply_job_only_runs_on_dispatch_or_major_bump(repo_root: Path) -> None:
    workflow = _load_workflow(repo_root)
    apply_condition = str(workflow["jobs"]["apply"].get("if", ""))

    assert "workflow_dispatch" in apply_condition
    assert "major" in apply_condition


def test_minor_patch_bumps_get_advisory_only_no_apply(repo_root: Path) -> None:
    workflow = _load_workflow(repo_root)
    jobs = workflow["jobs"]

    assert "advisory" in jobs, "minor/patch bumps must still produce a visible advisory job"
    advisory_condition = str(jobs["advisory"].get("if", ""))
    assert "major" in advisory_condition  # excludes major, i.e. minor/patch only

    advisory_texts = " ".join(_step_texts(jobs["advisory"]))
    assert "weave-hammerbarn-seed" not in advisory_texts, (
        "advisory job must never invoke the apply CLI"
    )


def test_apply_job_never_hardcodes_a_secret(repo_root: Path) -> None:
    """DoD: "no secrets in workflow files" -- the token used to call the live
    API is minted at runtime via mock OIDC's own /login+/token flow (Law F:
    no real cloud calls in CI), never a stored credential."""
    workflow = _load_workflow(repo_root)
    texts = " ".join(_step_texts(workflow["jobs"]["apply"]))

    assert "secrets." not in texts
    assert "::add-mask::" in texts, "the minted bearer token must be masked in job logs"
