"""TASK-009 (build-engine EPIC-008/EPIC-009) FR-034/AC-5: release/rollback-
plan artefact. `render_release_plan` is a pure renderer; `emit_release_plan`
writes it to a scratch workspace and commits it via the project's `ScmDriver`
(Law F: never a real GitHub/GitLab call in tests -- the driver is injected).

ADR-020 covers field placement (approvers/target_date on `Project`,
deploy_sequence/feature_flags on `GenerationRun`) and the "unset -> TBD,
never fabricated" rule this renderer follows (mirrors FR-036's staleness
`"unknown"` honesty principle).
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from weave_backend.generation.store import GenerationRun
from weave_backend.projects.model import Project
from weave_backend.repo_bootstrap.drivers import RepoHandle, ScmDriver

RELEASE_PLAN_PATH = "docs/release-plan.md"

_TBD = "_TBD -- not yet set_"


def _render_list_section(heading: str, items: list[str] | None) -> str:
    if not items:
        return f"## {heading}\n\n{_TBD}\n"
    body = "\n".join(f"- {item}" for item in items)
    return f"## {heading}\n\n{body}\n"


def render_release_plan(
    *,
    rollout: list[str] | None,
    flags: list[str] | None,
    approvers: list[str] | None,
    target_date: str | None,
) -> str:
    """AC-5: all four required sections render unconditionally -- an unset
    field prints `_TBD -- not yet set_`, never a fabricated value.
    """
    sections = [
        _render_list_section("Rollout Sequence", rollout),
        _render_list_section("Feature-Flag Rollback Path", flags),
        _render_list_section("Approvers", approvers),
        f"## Target Date\n\n{target_date if target_date else _TBD}\n",
    ]
    return "# Release / Rollback Plan\n\n" + "\n".join(sections)


async def emit_release_plan(
    *, project: Project, run: GenerationRun, repo: RepoHandle, driver: ScmDriver, token: str
) -> str:
    """Render the plan and commit it as the single file on `run.branch`
    (the same branch the generated app was committed to -- AC-5).
    """
    plan = render_release_plan(
        rollout=run.deploy_sequence,
        flags=run.feature_flags,
        approvers=project.signoff_roles,
        target_date=str(project.target_date) if project.target_date else None,
    )
    workspace = tempfile.mkdtemp(prefix=f"release-plan-{run.task_id}-")
    try:
        plan_path = Path(workspace) / RELEASE_PLAN_PATH
        plan_path.parent.mkdir(parents=True, exist_ok=True)
        plan_path.write_text(plan)
        return await driver.commit_workspace(
            repo,
            workspace=workspace,
            branch=run.branch,
            message="chore: release/rollback plan",
            token=token,
        )
    finally:
        shutil.rmtree(workspace, ignore_errors=True)
