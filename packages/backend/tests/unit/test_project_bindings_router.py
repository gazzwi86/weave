"""TASK-022 unit tests: `routers/project_bindings.py`. Mirrors
`test_project_contributors_router.py`'s direct-call pattern: call the route
coroutine directly with `tenant_connection` and its `pm.bindings`/
connector-client collaborators patched, no docker/Postgres needed. Coverage
must come from this unit lane (PROJ-013: the docker/asyncpg lane can't run
`--cov`).
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.connectors.client import ConnectorHealth, ConnectorInstance, ConnectorUnavailable
from weave_backend.pm.bindings import Binding, DuplicateBinding
from weave_backend.rbac import InsufficientProjectRole, ProjectAction, require_project_role
from weave_backend.routers.project_bindings import (
    bind_route,
    delete_binding_route,
    list_bindings_route,
)
from weave_backend.schemas.bindings import BindRequest

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:admin-1")
_PROJECT_IRI = "urn:weave:project:t1:acme-corp"
_BINDING = Binding(
    binding_id="b-1",
    project_iri=_PROJECT_IRI,
    system="jira",
    connector_ref="jira-1",
    space_ref="ACME",
    created_by=_PRINCIPAL.principal_iri,
    created_at=datetime(2026, 7, 1, tzinfo=UTC),
)


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_list_bindings_route_returns_health_per_row() -> None:
    with (
        patch(
            "weave_backend.routers.project_bindings.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.project_bindings.get_all", AsyncMock(return_value=[_BINDING])
        ),
        patch(
            "weave_backend.routers.project_bindings.default_connector_client.health",
            AsyncMock(
                return_value=ConnectorHealth(
                    status="ok", last_sync=None, last_error=None, error_count=0, skipped_count=0
                )
            ),
        ),
    ):
        result = await list_bindings_route(_PROJECT_IRI, _PRINCIPAL)

    assert len(result.items) == 1
    assert result.items[0].space_ref == "ACME"
    assert result.items[0].health.status == "ok"


async def test_list_bindings_route_shows_health_unavailable_on_read_failure() -> None:
    """AC-3: a health-read failure never fakes green -- and never 500s the
    whole GET (per-row isolation).
    """
    with (
        patch(
            "weave_backend.routers.project_bindings.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.project_bindings.get_all", AsyncMock(return_value=[_BINDING])
        ),
        patch(
            "weave_backend.routers.project_bindings.default_connector_client.health",
            AsyncMock(side_effect=ConnectorUnavailable("jira-1")),
        ),
    ):
        result = await list_bindings_route(_PROJECT_IRI, _PRINCIPAL)

    assert result.items[0].health.status == "unavailable"


async def test_bind_route_rejects_unknown_connector_instance() -> None:
    body = BindRequest(system="jira", connector_ref="not-configured", space_ref="ACME")

    with (
        patch(
            "weave_backend.routers.project_bindings.default_connector_client.list_instances",
            AsyncMock(return_value=[ConnectorInstance(handle="jira-1", connector_type="jira")]),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await bind_route(_PROJECT_IRI, body, _PRINCIPAL)

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "unknown_instance",
        "available": ["jira-1"],
    }


async def test_bind_route_rejects_duplicate_binding() -> None:
    body = BindRequest(system="jira", connector_ref="jira-1", space_ref="ACME")

    with (
        patch(
            "weave_backend.routers.project_bindings.default_connector_client.list_instances",
            AsyncMock(return_value=[ConnectorInstance(handle="jira-1", connector_type="jira")]),
        ),
        patch(
            "weave_backend.routers.project_bindings.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.project_bindings.put",
            AsyncMock(side_effect=DuplicateBinding("jira", "ACME")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await bind_route(_PROJECT_IRI, body, _PRINCIPAL)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "duplicate_binding",
        "system": "jira",
        "space_ref": "ACME",
    }


async def test_bind_route_creates_binding_when_instance_known() -> None:
    body = BindRequest(system="jira", connector_ref="jira-1", space_ref="ACME")

    with (
        patch(
            "weave_backend.routers.project_bindings.default_connector_client.list_instances",
            AsyncMock(return_value=[ConnectorInstance(handle="jira-1", connector_type="jira")]),
        ),
        patch(
            "weave_backend.routers.project_bindings.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.project_bindings.put", AsyncMock(return_value=_BINDING)
        ) as put_mock,
        patch(
            "weave_backend.routers.project_bindings.default_connector_client.health",
            AsyncMock(
                return_value=ConnectorHealth(
                    status="ok", last_sync=None, last_error=None, error_count=0, skipped_count=0
                )
            ),
        ),
    ):
        result = await bind_route(_PROJECT_IRI, body, _PRINCIPAL)

    assert result.space_ref == "ACME"
    put_mock.assert_awaited_once()
    assert put_mock.await_args is not None
    kwargs = put_mock.await_args.kwargs
    assert kwargs["binding"].project_iri == _PROJECT_IRI
    assert kwargs["binding"].created_by == _PRINCIPAL.principal_iri


async def test_delete_binding_route_removes_a_binding() -> None:
    with (
        patch(
            "weave_backend.routers.project_bindings.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.project_bindings.delete", AsyncMock(return_value=None)
        ) as delete_mock,
    ):
        await delete_binding_route(_PROJECT_IRI, "b-1", _PRINCIPAL)

    delete_mock.assert_awaited_once_with(None, tenant_id=_PRINCIPAL.tenant_id, binding_id="b-1")


async def test_list_bindings_route_isolates_slow_health_read_from_the_others() -> None:
    """QA edge case for TASK-022's brief-named integration test `should
    isolate slow health read to one badge` (AC-3; API Contract: "a slow
    connector degrades one badge, not the request"; Implementation Hints:
    "short per-read timeout ... one slow connector must not drag the
    tab"). RED on purpose: `_read_health` has no timeout, so
    `list_bindings_route`'s `asyncio.gather` waits for the slowest
    connector before returning ANY row. This is the objective evidence
    for the QA failure report -- do not silence/xfail it; the fix is a
    per-read timeout in `_read_health`, not a test change.
    """
    slow_binding = replace(_BINDING, binding_id="b-2", connector_ref="jira-2", space_ref="OTHER")

    async def _health(connector_ref: str) -> ConnectorHealth:
        if connector_ref == "jira-2":
            await asyncio.sleep(0.3)
        return ConnectorHealth(
            status="ok", last_sync=None, last_error=None, error_count=0, skipped_count=0
        )

    with (
        patch(
            "weave_backend.routers.project_bindings.tenant_connection", _fake_tenant_connection
        ),
        patch(
            "weave_backend.routers.project_bindings.get_all",
            AsyncMock(return_value=[_BINDING, slow_binding]),
        ),
        patch(
            "weave_backend.routers.project_bindings.default_connector_client.health",
            AsyncMock(side_effect=_health),
        ),
    ):
        started = time.monotonic()
        result = await list_bindings_route(_PROJECT_IRI, _PRINCIPAL)
        elapsed = time.monotonic() - started

    fast_health = next(item for item in result.items if item.connector_ref == "jira-1").health
    assert fast_health.status == "ok"
    assert elapsed < 0.1, (
        f"list_bindings_route took {elapsed:.3f}s -- a slow connector health read "
        "is blocking the whole request instead of degrading only its own badge "
        "(missing per-read timeout in _read_health, AC-3 isolation)"
    )


async def test_bindings_guard_403s_editor_without_bindings_action() -> None:
    """PUT/DELETE .../bindings guard: an editor grant (`PROJECT_ROLE_ACTIONS`
    has no `BINDINGS` for "editor") is refused (AC-5).
    """
    dependency = require_project_role(ProjectAction.BINDINGS)

    with (
        patch("weave_backend.rbac.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.rbac.get_contributor_role", AsyncMock(return_value="editor")),
        pytest.raises(InsufficientProjectRole) as exc_info,
    ):
        await dependency(_PROJECT_IRI, _PRINCIPAL)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "forbidden",
        "action": "bindings",
    }
