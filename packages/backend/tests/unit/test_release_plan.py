"""TASK-009 (build-engine EPIC-008/EPIC-009) unit tests: FR-034/AC-5
release/rollback-plan artefact. `render_release_plan` is a pure function
(no DB, no network); `emit_release_plan` commits it via `ScmDriver` --
Law F: stubbed driver, never a real GitHub/GitLab call. ADR-020 covers the
field placement + the "unset -> TBD, never fabricated" renderer rule.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from pathlib import Path
from unittest.mock import AsyncMock

from weave_backend.deploy.release_plan import (
    RELEASE_PLAN_PATH,
    emit_release_plan,
    render_release_plan,
)
from weave_backend.generation.store import GenerationRun
from weave_backend.projects.model import Project
from weave_backend.repo_bootstrap.drivers import RepoHandle


def test_render_release_plan_includes_all_required_sections() -> None:
    """AC-5: rollout sequence, feature-flag rollback path, approvers,
    target date -- all four sections present.
    """
    plan = render_release_plan(
        rollout=["deploy dev", "deploy staging", "manual gate", "deploy prod"],
        flags=["widget_list_v2: rollback by disabling flag"],
        approvers=["platform-lead", "eng-manager"],
        target_date="2026-08-01",
    )

    assert "## Rollout Sequence" in plan
    assert "deploy staging" in plan
    assert "## Feature-Flag Rollback Path" in plan
    assert "widget_list_v2" in plan
    assert "## Approvers" in plan
    assert "platform-lead" in plan
    assert "## Target Date" in plan
    assert "2026-08-01" in plan


def test_render_release_plan_shows_tbd_never_fabricated_on_unset_fields() -> None:
    """AC-4-style honesty (mirrored for FR-034 per ADR-020): an unset field
    renders `TBD`, never a fabricated value (e.g. no invented date/branch).
    """
    plan = render_release_plan(rollout=None, flags=None, approvers=None, target_date=None)

    assert plan.count("_TBD -- not yet set_") == 4


async def test_emit_release_plan_commits_single_file_with_rendered_sections() -> None:
    """`should commit release plan artefact with required sections` (AC-5
    integration mapping) -- exercised here against a stubbed `ScmDriver`
    per Law F, asserting the committed workspace's file has every section.
    """
    driver = AsyncMock()
    driver.commit_workspace = AsyncMock(return_value="sha-plan-1")
    committed_content: dict[str, str] = {}

    async def _capture_commit_workspace(
        repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        del repo, branch, message, token
        committed_content["text"] = (Path(workspace) / RELEASE_PLAN_PATH).read_text()
        return "sha-plan-1"

    driver.commit_workspace.side_effect = _capture_commit_workspace

    project = Project(
        project_iri="urn:weave:project:t1:acme",
        name="Acme",
        pinned_graph_version_iri="urn:weave:version:v1",
        created_at=datetime.now(UTC),
        signoff_roles=["platform-lead"],
        target_date=date(2026, 8, 1),
    )
    run = GenerationRun(
        run_id="run-1",
        project_iri="urn:weave:project:t1:acme",
        task_id="task-1",
        branch="build/acme/task-1",
        commit_sha="sha-123",
        deploy_sequence=["dev", "staging", "prod"],
        feature_flags=["widget_list_v2"],
    )
    repo = RepoHandle(
        repo_id="acme/weave-acme", url="https://github.com/acme/weave-acme", default_branch="main"
    )

    commit_sha = await emit_release_plan(
        project=project, run=run, repo=repo, driver=driver, token="tok"
    )

    assert commit_sha == "sha-plan-1"
    driver.commit_workspace.assert_awaited_once()
    call = driver.commit_workspace.await_args
    assert call.kwargs["branch"] == "build/acme/task-1"
    assert "## Rollout Sequence" in committed_content["text"]
    assert "staging" in committed_content["text"]
    assert "## Approvers" in committed_content["text"]
    assert "platform-lead" in committed_content["text"]
