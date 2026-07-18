"""BE-TASK-002 unit tests: `create_brief_route`/`get_brief_route`'s own
error-shape logic exercised directly (not through HTTP) with `tenant_connection`
and its DB collaborators patched out -- mirrors `test_projects_router.py`'s
pattern (BE-TASK-001). 401 goes through the real ASGI app instead, since
that's the shared auth boundary, not brief-specific logic.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal
from weave_backend.briefs.architect import ModelRoutingMiss
from weave_backend.briefs.ce_read_client import CeReadUnavailable
from weave_backend.briefs.store import StoredBrief
from weave_backend.routers.briefs import create_brief_route, get_brief_route
from weave_backend.schemas.briefs import CreateBriefRequest

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
_PROJECT_IRI = "urn:weave:project:t1:acme"


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_create_brief_route_returns_401_without_jwt() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            f"/api/projects/{_PROJECT_IRI}/briefs", json={"task_description": "Do the thing"}
        )

    assert response.status_code == 401


async def test_architect_503_when_ce_read_unavailable() -> None:
    body = CreateBriefRequest(task_description="Do the thing")

    with (
        patch("weave_backend.routers.briefs.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.briefs.get_bpmo_context",
            AsyncMock(side_effect=CeReadUnavailable("boom")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await create_brief_route(_PROJECT_IRI, body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {"error": "ce_read_unavailable"}  # type: ignore[comparison-overlap]


async def test_create_brief_route_emits_audit_event_on_model_routing_miss() -> None:
    """QA edge case (AC-6): "a routing miss MUST halt the agent and emit a
    PLAT-AUDIT-1 event" -- the halt (500 ``model_routing_miss``) is
    implemented, but no audit event is emitted on this path. This is the
    same ``default_audit_emitter.emit`` seam the success path already uses
    (see ``test_create_brief_route_returns_201_and_emits_audit_event``);
    a routing-miss halt is exactly the kind of security-relevant event
    PLAT-AUDIT-1 exists to record. Currently RED -- see QA report BE-TASK-002.
    """
    body = CreateBriefRequest(task_description="Do the thing")

    with (
        patch("weave_backend.routers.briefs.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.briefs.get_bpmo_context", AsyncMock(return_value={})),
        patch(
            "weave_backend.routers.briefs.draft_brief_document",
            side_effect=ModelRoutingMiss("fable"),
        ),
        patch("weave_backend.routers.briefs.default_audit_emitter.emit", AsyncMock()) as mock_emit,
        pytest.raises(HTTPException) as exc_info,
    ):
        await create_brief_route(_PROJECT_IRI, body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 500
    mock_emit.assert_awaited_once()


async def test_architect_rejects_brief_missing_ears_acs() -> None:
    body = CreateBriefRequest(task_description="Do the thing")
    invalid_raw_brief = {
        "schema_version": "1.0",
        "task_id": "task-1",
        "project_iri": _PROJECT_IRI,
        "title": "Do the thing",
        "user_story": "As a user I want the thing so that value",
        # acceptance_criteria omitted -- AC-2
        "ac_to_test_map": [],
        "dor_checklist": ["User story clear"],
        "dod_checklist": ["All AC met"],
        "dep_chain": {"blocked_by": [], "unlocks": []},
        "cost_estimate": {
            "complexity": "S",
            "estimated_tokens_input_k": 1,
            "estimated_tokens_output_k": 1,
            "estimated_cost_usd": 0.1,
        },
        "generated_at": "2026-07-04T00:00:00Z",
    }

    with (
        patch("weave_backend.routers.briefs.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.briefs.get_bpmo_context", AsyncMock(return_value={})),
        patch(
            "weave_backend.routers.briefs.draft_brief_document",
            return_value=invalid_raw_brief,
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await create_brief_route(_PROJECT_IRI, body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 422
    detail = cast(dict[str, object], exc_info.value.detail)
    assert detail["error"] == "brief_invalid"
    missing_fields = cast(list[str], detail["missing_fields"])
    assert "acceptance_criteria" in missing_fields


async def test_get_brief_route_404_when_not_found() -> None:
    with (
        patch("weave_backend.routers.briefs.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.briefs.get_task_brief", AsyncMock(return_value=None)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await get_brief_route(_PROJECT_IRI, "task-1", _PRINCIPAL)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "not_found"}  # type: ignore[comparison-overlap]


async def test_get_brief_route_returns_stored_document() -> None:
    stored = StoredBrief(
        task_id="task-1",
        brief_iri="urn:weave:brief:task-1",
        schema_version="1.0",
        content={"schema_version": "1.0", "title": "Do the thing"},
    )

    with (
        patch("weave_backend.routers.briefs.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.briefs.get_task_brief", AsyncMock(return_value=stored)),
    ):
        result = await get_brief_route(_PROJECT_IRI, "task-1", _PRINCIPAL)

    assert result.task_id == "task-1"
    assert result.schema_version == "1.0"
    assert result.content["title"] == "Do the thing"


async def test_create_brief_route_returns_201_and_emits_audit_event() -> None:
    body = CreateBriefRequest(task_description="Do the thing")
    valid_raw_brief = {
        "schema_version": "1.0",
        "task_id": "will-be-overwritten",
        "project_iri": _PROJECT_IRI,
        "title": "Do the thing",
        "user_story": "As a user I want the thing so that value",
        "acceptance_criteria": [
            {"id": "AC-1", "criterion": "WHEN X THE SYSTEM SHALL Y", "test_mapping": "test_x"}
        ],
        "ac_to_test_map": [{"ac_id": "AC-1", "test_name": "test_x"}],
        "dor_checklist": ["User story clear"],
        "dod_checklist": ["All AC met"],
        "dep_chain": {"blocked_by": [], "unlocks": []},
        "cost_estimate": {
            "complexity": "S",
            "estimated_tokens_input_k": 1,
            "estimated_tokens_output_k": 1,
            "estimated_cost_usd": 0.1,
        },
        "generated_at": "2026-07-04T00:00:00Z",
    }
    created_at = datetime.now(UTC)

    with (
        patch("weave_backend.routers.briefs.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.briefs.get_bpmo_context", AsyncMock(return_value={})),
        patch(
            "weave_backend.routers.briefs.draft_brief_document",
            return_value=valid_raw_brief,
        ),
        patch(
            "weave_backend.routers.briefs.insert_task_brief",
            AsyncMock(return_value=created_at),
        ),
        patch("weave_backend.routers.briefs.default_audit_emitter.emit", AsyncMock()) as mock_emit,
    ):
        result = await create_brief_route(_PROJECT_IRI, body, _PRINCIPAL, httpx.AsyncClient())

    assert result.brief_iri.startswith("urn:weave:brief:")
    assert result.stored_at == created_at.isoformat()
    mock_emit.assert_awaited_once()
    assert mock_emit.await_args is not None
    emitted_event = mock_emit.await_args.args[1]
    assert emitted_event.event_type == "brief_generated"


async def test_create_brief_route_threads_epic_id_and_title_into_persisted_content() -> None:
    """G9 (docs/design/remediation-2-api-gaps.md): the architect draft
    (`draft_brief_document`) never knows about epics -- the caller supplies
    `epic_id`/`epic_title` on the request, and the router stamps them onto
    the brief before persisting, same as `task_id`/`project_iri`.
    """
    body = CreateBriefRequest(
        task_description="Do the thing", epic_id="EPIC-004", epic_title="Build dashboard"
    )
    valid_raw_brief = {
        "schema_version": "1.0",
        "task_id": "will-be-overwritten",
        "project_iri": _PROJECT_IRI,
        "title": "Do the thing",
        "user_story": "As a user I want the thing so that value",
        "acceptance_criteria": [
            {"id": "AC-1", "criterion": "WHEN X THE SYSTEM SHALL Y", "test_mapping": "test_x"}
        ],
        "ac_to_test_map": [{"ac_id": "AC-1", "test_name": "test_x"}],
        "dor_checklist": ["User story clear"],
        "dod_checklist": ["All AC met"],
        "dep_chain": {"blocked_by": [], "unlocks": []},
        "cost_estimate": {
            "complexity": "S",
            "estimated_tokens_input_k": 1,
            "estimated_tokens_output_k": 1,
            "estimated_cost_usd": 0.1,
        },
        "generated_at": "2026-07-04T00:00:00Z",
    }

    with (
        patch("weave_backend.routers.briefs.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.briefs.get_bpmo_context", AsyncMock(return_value={})),
        patch(
            "weave_backend.routers.briefs.draft_brief_document",
            return_value=valid_raw_brief,
        ),
        patch(
            "weave_backend.routers.briefs.insert_task_brief",
            AsyncMock(return_value=datetime.now(UTC)),
        ) as mock_insert,
        patch("weave_backend.routers.briefs.default_audit_emitter.emit", AsyncMock()),
    ):
        await create_brief_route(_PROJECT_IRI, body, _PRINCIPAL, httpx.AsyncClient())

    assert mock_insert.await_args is not None
    stored_content = mock_insert.await_args.args[1].content
    assert stored_content["epic_id"] == "EPIC-004"
    assert stored_content["epic_title"] == "Build dashboard"
