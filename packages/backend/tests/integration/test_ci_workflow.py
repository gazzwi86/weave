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

    for job_name in ("api", "web", "secrets"):
        assert jobs[job_name].get("timeout-minutes", 999) <= 10, (
            f"{job_name} job must report within the 10-minute PR-check budget"
        )

    # mutation gets its own, larger budget: the corpus (~13.4k mutants) outgrew the
    # 10-min window (PR48 timed out twice at 96% complete, no code defect -- see
    # ci.yml's mutation job comment). Sharded 2-way in parallel + timeout raised to
    # match, per explicit operator direction (this session).
    assert jobs["mutation"].get("timeout-minutes", 999) <= 20, (
        "mutation job must report within the 20-minute PR-check budget"
    )

    # Mutation is a single 60% bar (ADV-005) enforced in two tiers that differ in
    # depth, not in the bar: per-PR runs unit-only (fast, BLOCKING); `mutation-strict`
    # re-runs it on main-push with live services. Both use mutation_gate's default.
    from weave_backend.scripts.mutation_gate import DEFAULT_THRESHOLD

    per_pr = jobs["mutation"]
    per_pr_texts = " ".join(_step_texts(per_pr))
    assert "mutmut" in per_pr_texts, "mutation job must actually run mutmut"
    assert "weave_backend.scripts.mutation_gate" in per_pr_texts, (
        "mutation job must invoke the gate script"
    )
    # blocking: no continue-on-error at job level, and the gate step propagates
    # its exit code (pipefail, no `|| true` swallow).
    assert per_pr.get("continue-on-error") is not True, (
        "per-PR mutation gate must be blocking, not continue-on-error"
    )
    gate_steps = [s for s in per_pr["steps"] if "mutation_gate" in str(s.get("run", ""))]
    assert gate_steps, "mutation job must have a gate-enforcement step"
    gate = gate_steps[0]
    assert gate.get("continue-on-error") is not True, "gate step must not be continue-on-error"
    assert "|| true" not in gate["run"], "gate step must propagate its exit code"
    assert "pipefail" in gate["run"], "gate step's tee pipeline must set pipefail"
    # single bar: the per-PR tier sets no threshold override — it enforces the
    # same 60% default as the strict tier (ADV-005, "one 60% gate everywhere").
    assert "MUTATION_SCORE_THRESHOLD" not in (per_pr.get("env") or {}), (
        "per-PR job must not override the threshold — one 60% bar via the default"
    )
    assert DEFAULT_THRESHOLD == 60.0, "single mutation bar is 60% everywhere (ADV-005)"

    # strict deterministic tier: runs mutmut with services and NO threshold-lowering
    # env, so mutation_gate enforces the same 60% DEFAULT_THRESHOLD.
    strict = jobs["mutation-strict"]
    strict_texts = " ".join(_step_texts(strict))
    assert "mutmut" in strict_texts and "mutation_gate" in strict_texts
    assert "docker compose up" in strict_texts, "strict mutation job must boot services"
    assert strict.get("continue-on-error") is not True, "strict mutation job must be blocking"
    assert "MUTATION_SCORE_THRESHOLD" not in (strict.get("env") or {}), (
        "strict job must not override the threshold — it enforces the 60% default"
    )

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


def test_ci_runs_docker_marked_tenancy_security_suite(repo_root: Path) -> None:
    """PR #11 finding 5: the docker-marked tenancy security suite
    (`tests/integration/test_tenancy_isolation.py`) was never run in CI --
    the `api` job's `-m "not docker and not e2e"` filter explicitly excludes
    it, and nothing else picked it up. Assert a dedicated `integration` job
    boots the services those tests need and runs them, but stays clear of
    `test_local_stack.py` (marked `stack`), which manages its own
    full-stack lifecycle (incl. ollama) independently of this job.
    """
    workflow = _load_workflow(repo_root)
    jobs = workflow["jobs"]

    assert "integration" in jobs, "CI must run the docker-marked integration test job"
    job = jobs["integration"]
    texts = " ".join(_step_texts(job))

    assert "docker compose up" in texts
    for service in ("postgres", "redis", "oxigraph", "localstack"):
        assert service in texts, f"integration job must start {service}"
    assert "ollama" not in texts, "integration job must not need ollama"

    assert "integration and docker and not stack" in texts, (
        "integration job must run the docker+integration suite, excluding test_local_stack.py"
    )
    assert "docker compose down" in texts, "integration job must tear down the stack it started"
