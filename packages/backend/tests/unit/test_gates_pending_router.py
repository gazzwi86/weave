"""G12 (docs/design/remediation-2-api-gaps.md): `GET
/api/projects/{project_iri}/gates?status=pending` unit tests -- exercised
directly (not through HTTP), same pattern as `test_epics_router.py`. The
404-vs-empty-list split mirrors `routers/board.py`'s BUG-06 fix (a
run-less project reads as an empty pending-gate list, not a 404).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.build.state_spine import StateSpine, TaskState
from weave_backend.projects.model import Project
from weave_backend.routers.gates import get_pending_gates_route

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
_PROJECT_IRI = "urn:weave:project:t1:acme"
_MODULE = "weave_backend.routers.gates"


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


def _spine() -> StateSpine:
    return StateSpine(
        project_iri=_PROJECT_IRI,
        tenant_id="t1",
        run_id="r1",
        turn_cap=60,
        tasks=[TaskState(id="t-1", status="Blocked"), TaskState(id="t-2", status="Ready")],
    )


async def test_get_pending_gates_route_returns_only_blocked_tasks() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.load_state_spine", AsyncMock(return_value=_spine())),
    ):
        result = await get_pending_gates_route(_PROJECT_IRI, "pending", _PRINCIPAL)

    assert [g.task_id for g in result.gates] == ["t-1"]


async def test_get_pending_gates_route_project_with_no_run_yet_returns_empty_list() -> None:
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
    ):
        result = await get_pending_gates_route(_PROJECT_IRI, "pending", _PRINCIPAL)

    assert result.gates == []


async def test_get_pending_gates_route_404_when_project_does_not_exist() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.load_state_spine", AsyncMock(return_value=None)),
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=None)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await get_pending_gates_route(_PROJECT_IRI, "pending", _PRINCIPAL)

    assert exc_info.value.status_code == 404
