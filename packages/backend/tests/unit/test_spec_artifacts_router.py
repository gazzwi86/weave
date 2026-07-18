"""G11 (docs/design/remediation-2-api-gaps.md): `GET
/api/projects/{project_iri}/spec-artifacts` unit tests -- exercised
directly (not through HTTP), same pattern as `test_epics_router.py`. The
404-vs-empty-index split mirrors `routers/board.py`'s BUG-06 fix (a
run-less project reads as an empty index, not a 404).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.briefs.store import BriefRef
from weave_backend.build.state_spine import StateSpine, TaskState
from weave_backend.projects.model import Project
from weave_backend.routers.spec_artifacts import get_spec_artifacts_route

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
_PROJECT_IRI = "urn:weave:project:t1:acme"
_MODULE = "weave_backend.routers.spec_artifacts"


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


def _spine() -> StateSpine:
    return StateSpine(
        project_iri=_PROJECT_IRI,
        tenant_id="t1",
        run_id="r1",
        turn_cap=60,
        tasks=[TaskState(id="t-1", status="Done")],
    )


async def test_get_spec_artifacts_route_returns_one_entry_per_brief() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.load_state_spine", AsyncMock(return_value=_spine())),
        patch(
            f"{_MODULE}.list_project_briefs",
            AsyncMock(return_value=[BriefRef(task_id="t-1", brief_iri="urn:weave:brief:t-1")]),
        ),
    ):
        result = await get_spec_artifacts_route(_PROJECT_IRI, _PRINCIPAL)

    assert len(result.artifacts) == 1
    assert result.artifacts[0].status == "approved"


async def test_get_spec_artifacts_route_project_with_no_run_yet_returns_empty_index() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.load_state_spine", AsyncMock(return_value=None)),
        patch(
            f"{_MODULE}.get_project",
            AsyncMock(
                return_value=Project(
                    project_iri=_PROJECT_IRI,
                    name="acme",
                    pinned_graph_version_iri="urn:weave:graph-version:v1",
                    created_at=datetime.now(UTC),
                )
            ),
        ),
        patch(f"{_MODULE}.list_project_briefs", AsyncMock(return_value=[])),
    ):
        result = await get_spec_artifacts_route(_PROJECT_IRI, _PRINCIPAL)

    assert result.artifacts == []


async def test_get_spec_artifacts_route_404_when_project_does_not_exist() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.load_state_spine", AsyncMock(return_value=None)),
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=None)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await get_spec_artifacts_route(_PROJECT_IRI, _PRINCIPAL)

    assert exc_info.value.status_code == 404
