"""BE-TASK-009 unit tests for `publish_and_write_back`'s orchestration logic
(AC-1..AC-8): publish-then-write-back, `PublishError` degrading to a 200
body (AC-2), the BE-ARTEFACT-1 provenance header sent to CE-WRITE-1 (AC-3),
422 routing to HITL without committing (AC-4), spike-mode skip (AC-6), and
`CeWriteUnavailable` propagation (AC-8). `get_project`/
`get_generation_run_by_commit_sha`/`get_task_brief` are patched directly
(same domain-function-patching pattern as `test_generation_service.py`) --
real Postgres/LocalStack/audit-chain proof lives in
`tests/integration/test_deploy_api.py` (AC-5/AC-7).
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any, cast
from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.briefs.store import StoredBrief
from weave_backend.deploy.artefact_publisher import PublishError
from weave_backend.deploy.ce_write_client import CeWriteUnavailable
from weave_backend.deploy.service import (
    DeployContext,
    DeployDeps,
    GenerationRunNotFoundError,
    ProjectNotFoundError,
    publish_and_write_back,
)
from weave_backend.generation.store import GenerationRun
from weave_backend.projects.model import Project
from weave_backend.schemas.operations import ApplyResponse, ViolationsResponse

_MODULE = "weave_backend.deploy.service"


def _project(**overrides: Any) -> Project:
    fields: dict[str, Any] = {
        "project_iri": "urn:weave:project:t1:acme",
        "name": "Acme",
        "pinned_graph_version_iri": "urn:weave:version:v1",
        "created_at": datetime.now(UTC),
    }
    fields.update(overrides)
    return Project(**fields)


def _run() -> GenerationRun:
    return GenerationRun(
        run_id="run-1",
        project_iri="urn:weave:project:t1:acme",
        task_id="task-1",
        branch="build/acme/task-1",
        commit_sha="sha-123",
    )


def _brief(content: dict[str, Any] | None = None) -> StoredBrief:
    return StoredBrief(
        task_id="task-1",
        brief_iri="urn:weave:brief:task-1",
        schema_version="1.0",
        content=content
        if content is not None
        else {"tech_spec": "System urn:weave:system:widget-svc drives urn:weave:service:api"},
        created_at=datetime.now(UTC),
    )


def _ctx(run_mode: str = "spec_to_build") -> DeployContext:
    return DeployContext(
        tenant_id="t1",
        project_iri="urn:weave:project:t1:acme",
        task_id="task-1",
        commit_sha="sha-123",
        run_mode=run_mode,
        ce_write_client=AsyncMock(),
    )


def _deps(*, publish_fn: Any = None) -> tuple[DeployDeps, list[dict[str, object]]]:
    emitted: list[dict[str, object]] = []

    async def fake_publish(_commit_sha: str, _tenant_id: str, _run_id: str) -> str:
        return "s3://weave-artefacts/t1/run-1/"

    async def fake_emit_audit(_conn: Any, event: Any) -> None:
        emitted.append({"event_type": event.event_type, "payload": event.payload})

    deps = DeployDeps(publish_fn=publish_fn or fake_publish, emit_audit=fake_emit_audit)
    return deps, emitted


@contextmanager
def _patched(
    *, project: Project | None, run: GenerationRun | None, brief: StoredBrief | None
) -> Iterator[tuple[AsyncMock, AsyncMock, AsyncMock, AsyncMock, AsyncMock]]:
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=project)) as get_project_mock,
        patch(
            f"{_MODULE}.get_generation_run_by_commit_sha", AsyncMock(return_value=run)
        ) as get_run_mock,
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=brief)) as get_brief_mock,
        patch(f"{_MODULE}.update_project_publish", AsyncMock()) as update_publish_mock,
        patch(f"{_MODULE}.update_project_write_back", AsyncMock()) as update_write_back_mock,
    ):
        yield (
            get_project_mock,
            get_run_mock,
            get_brief_mock,
            update_publish_mock,
            update_write_back_mock,
        )


async def test_raises_project_not_found_when_project_missing() -> None:
    with (
        _patched(project=None, run=_run(), brief=_brief()),
        pytest.raises(ProjectNotFoundError),
    ):
        await publish_and_write_back(AsyncMock(), _ctx(), _deps()[0])


async def test_raises_generation_run_not_found_when_run_missing() -> None:
    with (
        _patched(project=_project(), run=None, brief=_brief()),
        pytest.raises(GenerationRunNotFoundError),
    ):
        await publish_and_write_back(AsyncMock(), _ctx(), _deps()[0])


async def test_publish_failure_retains_prior_output_location_ref() -> None:
    """AC-2."""

    async def failing_publish(*_args: object) -> str:
        raise PublishError("bucket unreachable")

    deps, _ = _deps(publish_fn=failing_publish)
    prior = _project(demo_output_location_ref="s3://weave-artefacts/t1/prior-run/")
    with _patched(project=prior, run=_run(), brief=_brief()):
        outcome = await publish_and_write_back(AsyncMock(), _ctx(), deps)

    assert outcome == {
        "publish_status": "failed",
        "error": "bucket unreachable",
        "prior_output_location_ref": "s3://weave-artefacts/t1/prior-run/",
    }


async def test_returns_output_location_ref_on_successful_publish() -> None:
    """AC-1 (isolated via spike mode, which returns right after publish)."""
    deps, _ = _deps()
    with _patched(project=_project(), run=_run(), brief=_brief()):
        outcome = await publish_and_write_back(AsyncMock(), _ctx(run_mode="spike"), deps)

    assert outcome["output_location_ref"] == "s3://weave-artefacts/t1/run-1/"


async def test_skip_write_back_and_return_skipped_reason_when_run_mode_is_spike() -> None:
    """AC-6."""
    deps, _ = _deps()
    with _patched(project=_project(), run=_run(), brief=_brief()):
        outcome = await publish_and_write_back(AsyncMock(), _ctx(run_mode="spike"), deps)

    assert outcome["write_back_status"] == "skipped"
    assert outcome["reason"] == "spike_mode"


async def test_write_back_calls_ce_write_1_with_provenance_header() -> None:
    """AC-3."""
    deps, _ = _deps()
    apply_mock = AsyncMock(
        return_value=ApplyResponse(
            activity_iri="urn:weave:activity:1",
            applied_count=1,
            version_iri="urn:weave:version:v2",
        )
    )
    with (
        _patched(project=_project(), run=_run(), brief=_brief()),
        patch(f"{_MODULE}.apply_write_back", apply_mock),
    ):
        await publish_and_write_back(AsyncMock(), _ctx(), deps)

    call = apply_mock.await_args
    assert call is not None
    ops = call.kwargs["operations"]
    assert ops, "expected at least one write-back operation"
    header = ops[0]["properties"]
    assert header["spec_id"] == "task-1"
    assert header["pinned_version_iri"] == "urn:weave:version:v1"
    assert "urn:weave:system:widget-svc" in header["entity_iris"]
    assert "urn:weave:service:api" in header["entity_iris"]


async def test_write_back_422_records_violations_and_routes_to_hitl() -> None:
    """AC-4."""
    deps, emitted = _deps()
    violations_response = ViolationsResponse.model_validate(
        {
            "violations": [
                {
                    "focus_node": "urn:weave:system:widget-svc",
                    "path": "urn:weave:bpmo:label",
                    "severity": "Violation",
                    "message": "missing label",
                }
            ]
        }
    )
    with (
        _patched(project=_project(), run=_run(), brief=_brief()) as (
            _get_project,
            _get_run,
            _get_brief,
            _update_publish,
            update_write_back,
        ),
        patch(f"{_MODULE}.apply_write_back", AsyncMock(return_value=violations_response)),
    ):
        outcome = await publish_and_write_back(AsyncMock(), _ctx(), deps)

        update_write_back.assert_not_awaited()

    violations = cast(list[dict[str, Any]], outcome["violations"])
    assert outcome["write_back_status"] == "rejected"
    assert violations[0]["message"] == "missing label"
    assert emitted == [
        {
            "event_type": "write_back_fail_shacl",
            "payload": {"violations": violations},
        }
    ]


async def test_ce_write_unavailable_propagates_uncommitted() -> None:
    """AC-8."""
    deps, _ = _deps()
    with (
        _patched(project=_project(), run=_run(), brief=_brief()) as (
            _get_project,
            _get_run,
            _get_brief,
            _update_publish,
            update_write_back,
        ),
        patch(
            f"{_MODULE}.apply_write_back",
            AsyncMock(side_effect=CeWriteUnavailable("down")),
        ),
        pytest.raises(CeWriteUnavailable),
    ):
        await publish_and_write_back(AsyncMock(), _ctx(), deps)

        update_write_back.assert_not_awaited()
