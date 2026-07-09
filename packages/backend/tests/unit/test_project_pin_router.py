"""TASK-016 unit tests: `routers/project_pin.py` (FR-012, CE-DIFF-1 diff +
explicit confirm). Direct-call pattern -- `tenant_connection`/CE-client
collaborators patched, no docker/Postgres or real CE needed (mirrors
`test_project_settings_router.py`).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.projects.ce_version_client import CeDiffUnavailable, CeVersionUnavailable
from weave_backend.projects.model import Project
from weave_backend.routers.project_pin import get_pin_diff_route, upgrade_pin_route
from weave_backend.schemas.project_pin import PinUpgradeRequest

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
_PROJECT_IRI = "urn:weave:project:t1:acme-corp"
_PROJECT = Project(
    project_iri=_PROJECT_IRI,
    name="Acme Corp",
    pinned_graph_version_iri="urn:weave:version:v1",
    created_at=datetime(2026, 1, 1, tzinfo=UTC),
)
_FAKE_CLIENT = httpx.AsyncClient(base_url="http://ce")


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_get_pin_diff_route_returns_diff_between_pin_and_latest() -> None:
    """AC-1: fetches CE-VERSION-1's latest, then CE-DIFF-1 between the
    project's current pin and that latest -- `versions` breaking-span
    passed through verbatim.
    """
    diff_body = {
        "added": [{"subject": "s", "predicate": "p", "object": "o"}],
        "removed": [],
        "modified": [],
        "versions": [{"version_iri": "urn:weave:version:v2", "breaking": True}],
    }
    with (
        patch("weave_backend.routers.project_pin.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.project_pin.get_project", AsyncMock(return_value=_PROJECT)),
        patch(
            "weave_backend.routers.project_pin.get_pinned_latest_version",
            AsyncMock(return_value="urn:weave:version:v2"),
        ),
        patch(
            "weave_backend.routers.project_pin.get_ontology_diff",
            AsyncMock(return_value=diff_body),
        ),
    ):
        result = await get_pin_diff_route(_PROJECT_IRI, _PRINCIPAL, _FAKE_CLIENT)

    assert result.from_version_iri == "urn:weave:version:v1"
    assert result.to_version_iri == "urn:weave:version:v2"
    assert len(result.added) == 1
    assert result.versions[0].version_iri == "urn:weave:version:v2"
    assert result.versions[0].breaking is True


async def test_get_pin_diff_route_404_when_project_missing() -> None:
    with (
        patch("weave_backend.routers.project_pin.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.project_pin.get_project", AsyncMock(return_value=None)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await get_pin_diff_route(_PROJECT_IRI, _PRINCIPAL, _FAKE_CLIENT)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "not_found"}  # type: ignore[comparison-overlap]


async def test_get_pin_diff_route_503_when_ce_version_unavailable() -> None:
    """AC-2: CE unreachable -> 503 `diff_unavailable`, never an empty diff."""
    with (
        patch("weave_backend.routers.project_pin.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.project_pin.get_project", AsyncMock(return_value=_PROJECT)),
        patch(
            "weave_backend.routers.project_pin.get_pinned_latest_version",
            AsyncMock(side_effect=CeVersionUnavailable("boom")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await get_pin_diff_route(_PROJECT_IRI, _PRINCIPAL, _FAKE_CLIENT)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {"error": "diff_unavailable"}  # type: ignore[comparison-overlap]


async def test_get_pin_diff_route_503_when_ce_diff_unavailable() -> None:
    with (
        patch("weave_backend.routers.project_pin.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.project_pin.get_project", AsyncMock(return_value=_PROJECT)),
        patch(
            "weave_backend.routers.project_pin.get_pinned_latest_version",
            AsyncMock(return_value="urn:weave:version:v2"),
        ),
        patch(
            "weave_backend.routers.project_pin.get_ontology_diff",
            AsyncMock(side_effect=CeDiffUnavailable("boom")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await get_pin_diff_route(_PROJECT_IRI, _PRINCIPAL, _FAKE_CLIENT)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {"error": "diff_unavailable"}  # type: ignore[comparison-overlap]


async def test_upgrade_pin_route_409_when_confirm_mismatches_latest() -> None:
    """AC-3: the pin moved under the caller (race) -- never blindly apply a
    stale `confirm_version_iri`. Re-verified against a freshly-fetched
    latest, not trusted from the client alone.
    """
    body = PinUpgradeRequest(confirm_version_iri="urn:weave:version:stale")
    with (
        patch(
            "weave_backend.routers.project_pin.get_pinned_latest_version",
            AsyncMock(return_value="urn:weave:version:v3"),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await upgrade_pin_route(_PROJECT_IRI, body, _PRINCIPAL, _FAKE_CLIENT)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "pin_moved",
        "latest_version_iri": "urn:weave:version:v3",
    }


async def test_upgrade_pin_route_updates_pin_and_emits_audit() -> None:
    """AC-4: atomic pin update + audit entry, same `tenant_connection`
    transaction (Law B -- asserts the write actually happens, not just a
    200).
    """
    body = PinUpgradeRequest(confirm_version_iri="urn:weave:version:v2")
    update_pin_mock = AsyncMock(return_value=None)
    emit_mock = AsyncMock(return_value=None)
    with (
        patch(
            "weave_backend.routers.project_pin.get_pinned_latest_version",
            AsyncMock(return_value="urn:weave:version:v2"),
        ),
        patch("weave_backend.routers.project_pin.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.project_pin.get_project", AsyncMock(return_value=_PROJECT)),
        patch("weave_backend.routers.project_pin.update_project_pin", update_pin_mock),
        patch("weave_backend.routers.project_pin.default_audit_emitter.emit", emit_mock),
    ):
        result = await upgrade_pin_route(_PROJECT_IRI, body, _PRINCIPAL, _FAKE_CLIENT)

    assert result.pinned_graph_version_iri == "urn:weave:version:v2"
    update_pin_mock.assert_awaited_once()
    emit_mock.assert_awaited_once()
    assert emit_mock.await_args is not None
    audit_event = emit_mock.await_args.args[1]
    assert audit_event.event_type == "project.pin.upgraded"
    assert audit_event.engine == "build"
    assert audit_event.payload == {
        "old_pin": "urn:weave:version:v1",
        "new_pin": "urn:weave:version:v2",
    }


async def test_upgrade_pin_route_404_when_project_missing() -> None:
    body = PinUpgradeRequest(confirm_version_iri="urn:weave:version:v2")
    with (
        patch(
            "weave_backend.routers.project_pin.get_pinned_latest_version",
            AsyncMock(return_value="urn:weave:version:v2"),
        ),
        patch("weave_backend.routers.project_pin.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.project_pin.get_project", AsyncMock(return_value=None)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await upgrade_pin_route(_PROJECT_IRI, body, _PRINCIPAL, _FAKE_CLIENT)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "not_found"}  # type: ignore[comparison-overlap]
