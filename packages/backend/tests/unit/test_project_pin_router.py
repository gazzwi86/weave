"""TASK-016 unit tests: `routers/project_pin.py` (FR-012, CE-DIFF-1 diff +
explicit confirm). Direct-call pattern -- `tenant_connection`/CE-client
collaborators patched, no docker/Postgres or real CE needed (mirrors
`test_project_settings_router.py`).
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
from fastapi.routing import APIRoute

from weave_backend.auth.dependencies import Principal
from weave_backend.projects.ce_version_client import CeDiffUnavailable, CeVersionUnavailable
from weave_backend.projects.model import Project
from weave_backend.rbac import InsufficientProjectRole, ProjectAction
from weave_backend.routers.project_pin import get_pin_diff_route, router, upgrade_pin_route
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


def _pin_upgrade_role_guard() -> object:
    """Extracts the actual `require_project_role(...)` closure wired via
    `Depends(...)` on the production `POST .../pin-upgrade` route (walks
    `router.routes`, not a reimplementation). AC-6's Test Mapping calls
    this "route registration asserted here" -- without it, deleting the
    `Depends(...)` from `upgrade_pin_route`'s signature would pass every
    other test in this file (they all call the route function directly,
    bypassing FastAPI's dependency resolution entirely).
    """
    matches = [
        api_route
        for api_route in router.routes
        if getattr(api_route, "path", None) == "/api/projects/{project_iri}/pin-upgrade"
        and "POST" in getattr(api_route, "methods", set())
    ]
    assert len(matches) == 1, "expected exactly one POST .../pin-upgrade route"
    api_route = cast(APIRoute, matches[0])
    # Matched on the closure's `action` freevar, not `__qualname__`: mutmut 3.x
    # rewrites every mutated module into `x_funcname__mutmut_N` trampoline
    # dispatch functions, which changes a nested closure's runtime qualname
    # even in the unmutated baseline pass. Freevar names survive that rewrite.
    guard_calls = [
        dep.call
        for dep in api_route.dependant.dependencies
        if "action" in getattr(getattr(dep.call, "__code__", None), "co_freevars", ())
    ]
    assert len(guard_calls) == 1, "upgrade_pin_route must Depends() on require_project_role(...)"
    return guard_calls[0]


def test_upgrade_pin_route_wires_the_settings_role_guard() -> None:
    """AC-6: the route is actually registered with a SETTINGS-scoped guard
    (not some other action, not missing entirely)."""
    guard = _pin_upgrade_role_guard()
    freevars = guard.__code__.co_freevars  # type: ignore[attr-defined]
    closure_values = dict(
        zip(freevars, (cell.cell_contents for cell in guard.__closure__ or ()), strict=True)  # type: ignore[attr-defined]
    )
    assert closure_values.get("action") == ProjectAction.SETTINGS


async def test_upgrade_pin_route_guard_403s_editor_without_settings_action() -> None:
    """Behavioural half of the same gap: invokes the exact guard instance
    wired on the production route (extracted above) and proves it refuses
    an editor grant, mirroring TASK-014's
    `test_patch_settings_guard_403s_editor_without_settings_action` pattern."""
    guard = _pin_upgrade_role_guard()

    with (
        patch("weave_backend.rbac.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.rbac.get_contributor_role", AsyncMock(return_value="editor")),
        pytest.raises(InsufficientProjectRole) as exc_info,
    ):
        await guard(_PROJECT_IRI, _PRINCIPAL)  # type: ignore[operator]

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {"error": "forbidden", "action": "settings"}  # type: ignore[comparison-overlap]
