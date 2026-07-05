"""BE-TASK-004 unit tests: `GET .../blast-radius`, `GET .../cost-estimate`,
`POST .../sign-off` own validation/error-shape logic, exercised directly
(not through HTTP) with collaborators patched out -- mirrors
`test_requests_router.py` / `test_projects_router.py`. AC-8 (401 without a
JWT) goes through the real ASGI app, the shared auth boundary.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import ANY, AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal
from weave_backend.projects.ce_version_client import CeVersionUnavailable
from weave_backend.projects.model import Project, ProjectExists
from weave_backend.requests.ce_read import CeReadUnavailable
from weave_backend.requests.store import RequestRecord
from weave_backend.routers.request_governance import (
    get_blast_radius_route,
    get_cost_estimate_route,
    submit_sign_off_route,
)
from weave_backend.schemas.requests import SignOffBody

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
_OTHER_PRINCIPAL = Principal(
    sub="u-2", tenant_id="t1", principal_iri="urn:weave:principal:user:u-2"
)


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


def _record(**overrides: object) -> RequestRecord:
    fields: dict[str, object] = {
        "request_id": "r1",
        "tenant_id": "t1",
        "run_mode": "draft_spec_only",
        "status": "draft_complete",
        "draft_content": {"brief": "touches urn:weave:entity:svc1"},
        "prompt": "build a widget tracker",
        "created_by_iri": "urn:weave:principal:user:u-1",
        "blast_radius_status": "computed",
    }
    fields.update(overrides)
    return RequestRecord(**fields)  # type: ignore[arg-type]


async def test_all_endpoints_401_without_jwt() -> None:
    """AC-8."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        responses = [
            await client.get("/api/requests/r1/blast-radius"),
            await client.get("/api/requests/r1/cost-estimate"),
            await client.post("/api/requests/r1/sign-off", json={"action": "approve"}),
        ]

    for response in responses:
        assert response.status_code == 401
        assert response.json() == {"error": "unauthorised"}
        assert response.headers["www-authenticate"] == "Bearer"


async def test_blast_radius_returns_unavailable_when_ce_unreachable() -> None:
    """AC-2."""
    with (
        patch(
            "weave_backend.routers.requests.store.get_request_record",
            AsyncMock(return_value=_record()),
        ),
        patch(
            "weave_backend.routers.requests.store.update_request_record", AsyncMock()
        ) as update_mock,
        patch(
            "weave_backend.routers.request_governance.compute_blast_radius",
            AsyncMock(side_effect=CeReadUnavailable("down")),
        ),
    ):
        result = await get_blast_radius_route("r1", _PRINCIPAL)

    assert result.status == "unavailable"
    assert result.message == "review manually"
    update_mock.assert_awaited_once_with(ANY, "r1", blast_radius_status="unavailable")


async def test_cost_estimate_returns_cap_and_flag() -> None:
    """AC-3."""
    record = _record(draft_content={"brief": "x" * 40000})
    with (
        patch(
            "weave_backend.routers.requests.store.get_request_record",
            AsyncMock(return_value=record),
        ),
        patch(
            "weave_backend.routers.request_governance.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.request_governance.resolve_cost_cap",
            AsyncMock(return_value=(0.05, "company")),
        ),
    ):
        result = await get_cost_estimate_route("r1", _PRINCIPAL)

    assert result.cap_usd == 0.05
    assert result.cap_level == "company"
    assert result.exceeds_cap is True
    assert result.estimate_usd > 0.05


async def test_sign_off_action_validation_error() -> None:
    body = SignOffBody(action="maybe")

    with pytest.raises(HTTPException) as exc_info:
        await submit_sign_off_route("r1", body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {"error": "validation_error", "field": "action"}  # type: ignore[comparison-overlap]


async def test_sign_off_blocked_until_blast_radius_acknowledged() -> None:
    """AC-7."""
    body = SignOffBody(action="approve", blast_radius_acknowledged=False)
    record = _record(blast_radius_status="unavailable")

    with (
        patch(
            "weave_backend.routers.requests.store.get_request_record",
            AsyncMock(return_value=record),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await submit_sign_off_route("r1", body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {"error": "blast_radius_not_acknowledged"}  # type: ignore[comparison-overlap]


async def test_sign_off_blocked_when_cost_cap_exceeded() -> None:
    """AC-4."""
    body = SignOffBody(action="approve")

    with (
        patch(
            "weave_backend.routers.requests.store.get_request_record",
            AsyncMock(return_value=_record()),
        ),
        patch(
            "weave_backend.routers.request_governance.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.request_governance.resolve_cost_cap",
            AsyncMock(return_value=(1.0, "company")),
        ),
        patch(
            "weave_backend.routers.request_governance.estimate_spec_cost",
            lambda _content: 100.0,
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await submit_sign_off_route("r1", body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "cost_cap_exceeded",
        "cap_usd": 1.0,
        "estimate_usd": 100.0,
    }


async def test_sign_off_reject_returns_to_draft() -> None:
    """AC-6."""
    body = SignOffBody(action="reject", rejection_reason="not needed right now")

    with (
        patch(
            "weave_backend.routers.requests.store.get_request_record",
            AsyncMock(return_value=_record()),
        ),
        patch(
            "weave_backend.routers.requests.store.update_request_record", AsyncMock()
        ) as update_mock,
        patch(
            "weave_backend.routers.request_governance.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.request_governance.resolve_cost_cap",
            AsyncMock(return_value=(25.0, "company")),
        ),
        patch(
            "weave_backend.routers.request_governance.record_sign_off", AsyncMock()
        ) as sign_off_mock,
    ):
        result = await submit_sign_off_route("r1", body, _PRINCIPAL, httpx.AsyncClient())

    assert result.status == "returned_to_draft"
    assert result.rejection_reason == "not needed right now"
    sign_off_mock.assert_awaited_once()
    assert sign_off_mock.await_args is not None
    assert sign_off_mock.await_args.args[1].action == "rejected"
    update_mock.assert_awaited_once_with(ANY, "r1", status="Draft")


async def test_sign_off_self_approval_returns_403() -> None:
    """Design decision B4 -- the submitter can't approve their own request."""
    body = SignOffBody(action="approve")

    with (
        patch(
            "weave_backend.routers.requests.store.get_request_record",
            AsyncMock(return_value=_record()),
        ),
        patch(
            "weave_backend.routers.request_governance.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.request_governance.resolve_cost_cap",
            AsyncMock(return_value=(25.0, "company")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        # _PRINCIPAL.principal_iri == the record's created_by_iri fixture default.
        await submit_sign_off_route("r1", body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {"error": "self_approval_not_permitted"}  # type: ignore[comparison-overlap]


async def test_sign_off_project_creation_failure_leaves_request_pending() -> None:
    """Implementation hint: a failed auto-create must not mark the request
    approved -- surface the error, leave it pending.
    """
    body = SignOffBody(action="approve")

    with (
        patch(
            "weave_backend.routers.requests.store.get_request_record",
            AsyncMock(return_value=_record()),
        ),
        patch(
            "weave_backend.routers.requests.store.update_request_record", AsyncMock()
        ) as update_mock,
        patch(
            "weave_backend.routers.request_governance.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.request_governance.resolve_cost_cap",
            AsyncMock(return_value=(25.0, "company")),
        ),
        patch("weave_backend.routers.request_governance.record_sign_off", AsyncMock()),
        patch(
            "weave_backend.routers.request_governance.resolve_required_stakeholders",
            AsyncMock(return_value=[]),
        ),
        patch(
            "weave_backend.routers.request_governance.get_approved_stakeholder_iris",
            AsyncMock(return_value=[]),
        ),
        patch(
            "weave_backend.routers.request_governance.find_existing_project_iri",
            AsyncMock(return_value=None),
        ),
        patch(
            "weave_backend.routers.request_governance.get_pinned_latest_version",
            AsyncMock(side_effect=CeVersionUnavailable("down")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await submit_sign_off_route("r1", body, _OTHER_PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {"error": "project_creation_unavailable"}  # type: ignore[comparison-overlap]
    update_mock.assert_not_called()


async def test_sign_off_all_approved_creates_project_unit() -> None:
    """AC-5, mocked collaborators (see `test_requests_governance_api.py` for
    the real-stack integration version).
    """
    body = SignOffBody(action="approve")

    with (
        patch(
            "weave_backend.routers.requests.store.get_request_record",
            AsyncMock(return_value=_record()),
        ),
        patch(
            "weave_backend.routers.requests.store.update_request_record", AsyncMock()
        ) as update_mock,
        patch(
            "weave_backend.routers.request_governance.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.request_governance.resolve_cost_cap",
            AsyncMock(return_value=(25.0, "company")),
        ),
        patch("weave_backend.routers.request_governance.record_sign_off", AsyncMock()),
        patch(
            "weave_backend.routers.request_governance.resolve_required_stakeholders",
            AsyncMock(return_value=["urn:weave:principal:user:u-2"]),
        ),
        patch(
            "weave_backend.routers.request_governance.get_approved_stakeholder_iris",
            AsyncMock(return_value=["urn:weave:principal:user:u-2"]),
        ),
        patch(
            "weave_backend.routers.request_governance.find_existing_project_iri",
            AsyncMock(return_value=None),
        ),
        patch(
            "weave_backend.routers.request_governance.get_pinned_latest_version",
            AsyncMock(return_value="urn:weave:version:v1"),
        ),
        patch(
            "weave_backend.routers.request_governance.create_project",
            AsyncMock(
                return_value=Project(
                    project_iri="urn:weave:project:t1:build-a-widget-tracker",
                    name="build a widget tracker",
                    pinned_graph_version_iri="urn:weave:version:v1",
                    created_at="2026-07-01T00:00:00Z",  # type: ignore[arg-type]
                )
            ),
        ),
    ):
        result = await submit_sign_off_route("r1", body, _OTHER_PRINCIPAL, httpx.AsyncClient())

    assert result.status == "approved"
    assert result.project_iri == "urn:weave:project:t1:build-a-widget-tracker"
    update_mock.assert_awaited_once_with(
        ANY, "r1", status="approved", project_iri="urn:weave:project:t1:build-a-widget-tracker"
    )


async def test_sign_off_pending_approvals_when_not_all_approved_unit() -> None:
    body = SignOffBody(action="approve")

    with (
        patch(
            "weave_backend.routers.requests.store.get_request_record",
            AsyncMock(return_value=_record()),
        ),
        patch(
            "weave_backend.routers.request_governance.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.request_governance.resolve_cost_cap",
            AsyncMock(return_value=(25.0, "company")),
        ),
        patch("weave_backend.routers.request_governance.record_sign_off", AsyncMock()),
        patch(
            "weave_backend.routers.request_governance.resolve_required_stakeholders",
            AsyncMock(
                return_value=["urn:weave:principal:user:u-2", "urn:weave:principal:user:u-3"]
            ),
        ),
        patch(
            "weave_backend.routers.request_governance.get_approved_stakeholder_iris",
            AsyncMock(return_value=["urn:weave:principal:user:u-2"]),
        ),
    ):
        result = await submit_sign_off_route("r1", body, _OTHER_PRINCIPAL, httpx.AsyncClient())

    assert result.status == "pending_approvals"
    assert result.remaining == ["urn:weave:principal:user:u-3"]


def test_project_exists_reuses_deterministic_iri() -> None:
    """ponytail: one runnable check on `ProjectExists`'s deterministic-IRI
    contract this module leans on in `_auto_create_project`.
    """
    exc = ProjectExists("urn:weave:project:t1:acme")
    assert exc.existing_iri == "urn:weave:project:t1:acme"
