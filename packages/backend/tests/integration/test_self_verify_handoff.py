"""BE-TASK-006 AC-4/AC-5 (build-engine EPIC-011) integration test:
`_dispatch_one`'s real wiring of `self_verify()`'s outcome onto the
`dep_summaries` handoff row, against real Postgres. Same lane conventions
as `test_runs_api.py` (`platform_stack` fixture, `run_dark_factory` driven
directly rather than via an HTTP route -- no run-lifecycle route exists in
this task's AC surface).

`resolve_rate_card_fn` is stubbed to an empty rate card -- unrelated to
self-verification, and no `build.cost.rate_card` `PLAT-SETTINGS-1` setting
is seeded for a fresh tenant/company (`resolve_rate_card` fails closed with
`RateCardConfigError` otherwise), same precedent as `test_orchestrator.py`'s
`_empty_rate_card`. `feature_dispatch_held` is pre-set `False` (already
scaffolded and released) so the run reaches the dispatch loop without a
real SCM round-trip -- `ensure_project_repo`'s idempotent short-circuit
covers the M1 floor once the repo row is seeded, and `rich_scaffold`'s own
idempotency check (`feature_dispatch_held is not None`) then no-ops.
"""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Any

import pytest

from weave_backend.build.dep_summary import DepSummary, get_dep_summary
from weave_backend.build.orchestrator import OrchestratorDeps, run_dark_factory
from weave_backend.build.state_spine import StateSpine, TaskState, start_or_resume_run
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.model import NewProject, create_project
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.store import set_feature_dispatch_held, set_project_repo
from weave_backend.schemas.tasks import SelfVerificationLine, TypedResult

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


async def _empty_rate_card(_conn: Any, *, tenant_id: str, project_iri: str) -> dict[str, Any]:
    return {}


async def _seed_released_project(tenant_id: str) -> str:
    """A project already scaffolded and released (`feature_dispatch_held`
    `False`) -- the run reaches the dispatch loop without touching a real
    or stubbed SCM driver.
    """
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug="acme",
                name="Acme",
                description=None,
                pinned_graph_version_iri="urn:weave:version:v1",
                source_control_provider="github",
                source_control_token_secret_ref="weave/unused-token-ref",
            ),
        )
        await set_project_repo(
            conn,
            tenant_id=tenant_id,
            project_iri=project.project_iri,
            provider="github",
            repo=RepoHandle(
                repo_id="acme/repo", url="https://scm/acme/repo", default_branch="main"
            ),
        )
        await set_feature_dispatch_held(
            conn, tenant_id=tenant_id, project_iri=project.project_iri, held=False
        )
    return project.project_iri


async def _dispatch_reporting_compliance(
    _conn: Any, *, tenant_id: str, project_iri: str, task: TaskState
) -> tuple[TypedResult, DepSummary]:
    result = TypedResult(
        status="PASS",
        retry_recommended=False,
        self_verification=[SelfVerificationLine(rule="lint", status="complied", note="ruff clean")],
    )
    return result, DepSummary(task_id=task.id, decisions=["used stub PDAC dispatch"])


async def test_should_persist_self_verification_block_on_handoff(platform_stack: Path) -> None:
    """AC-4: the agent's self-verification block travels through
    `_dispatch_one` onto the persisted `dep_summaries` handoff row -- a
    successor task's PLAN can read a predecessor's compliance record back
    from real Postgres, not just from the in-memory `TypedResult`.
    """
    tenant_id = _unique_tenant("tenant-selfverify")
    project_iri = await _seed_released_project(tenant_id)
    deps = OrchestratorDeps(
        dispatch_pdac_fn=_dispatch_reporting_compliance,
        applicable_rules_fn=lambda: ["lint"],
        resolve_rate_card_fn=_empty_rate_card,
    )

    async with tenant_connection(tenant_id) as conn:
        spine = await start_or_resume_run(
            conn,
            tenant_id=tenant_id,
            project_iri=project_iri,
            run_id=str(uuid.uuid4()),
            turn_cap=60,
        )
        spine.tasks.append(TaskState(id="t-1", status="Queued"))
        result_spine: StateSpine = await run_dark_factory(
            conn, spine, tenant_id=tenant_id, deps=deps
        )

        summary = await get_dep_summary(
            conn, tenant_id=tenant_id, project_iri=project_iri, task_id="t-1"
        )

    assert result_spine.tasks[0].status == "Done"
    assert summary is not None
    assert summary.decisions == ["used stub PDAC dispatch"]
    assert summary.self_verification == [
        SelfVerificationLine(rule="lint", status="complied", note="ruff clean")
    ]
