"""BE-TASK-003 unit tests: `POST /api/requests` and `GET /api/requests/
{id}`'s own validation/error-shape logic, exercised directly (not through
HTTP) with collaborators patched out -- mirrors `test_projects_router.py`.
401-without-a-JWT goes through the real ASGI app since that's the shared
auth boundary (mirrors `test_whoami.py` / `test_create_project_route_
returns_401_without_jwt`).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import BackgroundTasks, HTTPException
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal
from weave_backend.requests.store import RequestRecord
from weave_backend.routers.requests import create_request_route, get_request_route

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")


class _RecordingProvider:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def complete(self, model_id: str, prompt: str, **kwargs: object) -> str:
        self.calls.append((model_id, prompt))
        return "draft"


def _body(prompt: str = "build a widget", run_mode: str = "draft_spec_only") -> dict[str, str]:
    return {"prompt": prompt, "run_mode": run_mode}


async def test_create_request_route_returns_401_without_jwt() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/requests", json=_body())

    assert response.status_code == 401
    assert response.json() == {"detail": {"error": "unauthorised"}}
    assert response.headers["www-authenticate"] == "Bearer"


async def test_create_request_route_422_when_run_mode_invalid() -> None:
    from weave_backend.schemas.requests import CreateRequestBody

    body = CreateRequestBody(prompt="build a widget", run_mode="not_a_mode")

    with pytest.raises(HTTPException) as exc_info:
        await create_request_route(body, BackgroundTasks(), _PRINCIPAL, httpx.AsyncClient(), None)

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "validation_error",
        "field": "run_mode",
        "allowed": ["draft_spec_only", "spec_to_build", "spike"],
    }


async def test_create_request_route_422_when_prompt_empty() -> None:
    from weave_backend.schemas.requests import CreateRequestBody

    body = CreateRequestBody(prompt="   ", run_mode="draft_spec_only")

    with pytest.raises(HTTPException) as exc_info:
        await create_request_route(body, BackgroundTasks(), _PRINCIPAL, httpx.AsyncClient(), None)

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "validation_error",
        "field": "prompt",
    }


async def test_create_request_route_503_when_model_unavailable() -> None:
    from weave_backend.schemas.requests import CreateRequestBody

    body = CreateRequestBody(prompt="build a widget", run_mode="draft_spec_only")

    with (
        patch(
            "weave_backend.routers.requests._select_provider",
            side_effect=RuntimeError("no api key"),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await create_request_route(body, BackgroundTasks(), _PRINCIPAL, httpx.AsyncClient(), None)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {"error": "model_unavailable"}  # type: ignore[comparison-overlap]


async def test_create_request_route_returns_202_with_stream_url() -> None:
    from weave_backend.schemas.requests import CreateRequestBody

    body = CreateRequestBody(prompt="build a widget", run_mode="draft_spec_only")
    background_tasks = BackgroundTasks()

    with patch(
        "weave_backend.routers.requests.store.create_request_record", AsyncMock()
    ) as create_mock:
        result = await create_request_route(
            body, background_tasks, _PRINCIPAL, httpx.AsyncClient(), _RecordingProvider()
        )

    assert result.status == "drafting"
    assert result.stream_url == f"/api/requests/{result.request_id}/stream"
    create_mock.assert_awaited_once()
    assert len(background_tasks.tasks) == 1


async def test_get_request_route_404_when_missing() -> None:
    with patch(
        "weave_backend.routers.requests.store.get_request_record", AsyncMock(return_value=None)
    ), pytest.raises(HTTPException) as exc_info:
        await get_request_route("missing", _PRINCIPAL)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "not_found"}  # type: ignore[comparison-overlap]


def test_create_request_body_rejects_malformed_run_mode_type() -> None:
    """QA edge case: a malformed intake body (e.g. a client bug sending
    ``run_mode`` as a JSON array/number instead of a string) must fail
    Pydantic's own field-type validation at the trust boundary -- before
    ever reaching this router's hand-rolled allowed-set check.
    """
    from pydantic import ValidationError

    from weave_backend.schemas.requests import CreateRequestBody

    with pytest.raises(ValidationError):
        CreateRequestBody.model_validate(
            {"prompt": "build a widget", "run_mode": ["not", "a", "string"]}
        )


async def test_get_request_route_returns_record() -> None:
    record = RequestRecord(
        request_id="r1",
        tenant_id="t1",
        run_mode="draft_spec_only",
        status="draft_complete",
        graph_context="urn:weave:version:v1",
        draft_content={"brief": "hello"},
    )

    with patch(
        "weave_backend.routers.requests.store.get_request_record", AsyncMock(return_value=record)
    ):
        result = await get_request_route("r1", _PRINCIPAL)

    assert result.status == "draft_complete"
    assert result.draft_content == {"brief": "hello"}
