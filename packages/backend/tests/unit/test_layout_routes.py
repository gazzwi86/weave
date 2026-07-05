"""TASK-004 unit tests: layout-persistence routes, mocked DB (no docker) --
see tests/integration/test_layout_persistence.py for the real-Aurora RLS
proof. Mirrors test_search.py's direct-function-call-with-mocks style.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal
from weave_backend.routers.layout import LayoutApiError, get_positions, reset_layout, save_position
from weave_backend.schemas.layout import LayoutSaveRequest


def _principal(tenant_id: str = "3d6a8f2e-9b1c-4e5a-8f3d-1a2b3c4d5e6f") -> Principal:
    return Principal(sub="u-1", tenant_id=tenant_id, principal_iri="urn:weave:principal:user:u-1")


class _FakeConnection:
    def __init__(self) -> None:
        self.execute = AsyncMock(return_value=None)
        self.fetch = AsyncMock(return_value=[])


@asynccontextmanager
async def _fake_layout_connection(conn: _FakeConnection) -> AsyncIterator[_FakeConnection]:
    yield conn


_LAYOUT_CONNECTION_PATCH_TARGET = "weave_backend.routers.layout._layout_connection"


def _patch_layout_connection(monkeypatch: pytest.MonkeyPatch, conn: _FakeConnection) -> None:
    monkeypatch.setattr(_LAYOUT_CONNECTION_PATCH_TARGET, lambda _tid: _fake_layout_connection(conn))


async def test_save_position_returns_401_when_jwt_absent_on_post() -> None:
    """The 401 path is the shared `get_current_principal` dependency (out of
    scope for this task -- see ADR-004/progress summary), so this exercises
    real HTTP dispatch rather than a direct function call.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/layout/positions",
            json={
                "graph_id": "g1",
                "node_iri": "urn:weave:x:1",
                "position_x": 1.0,
                "position_y": 2.0,
            },
        )
    assert response.status_code == 401


async def test_save_position_returns_422_for_invalid_node_iri() -> None:
    body = LayoutSaveRequest(
        graph_id="g1",
        node_iri="not-an-iri",
        position_x=1.0,
        position_y=2.0,
        workspace_id="ws-1",
    )

    with pytest.raises(LayoutApiError) as exc_info:
        await save_position(body, _principal())

    assert exc_info.value.status_code == 422
    assert exc_info.value.body == {"error": "invalid_iri", "field": "node_iri"}


async def test_save_position_executes_parameterised_upsert_with_correct_ids(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = _FakeConnection()
    _patch_layout_connection(monkeypatch, conn)
    principal = _principal()
    body = LayoutSaveRequest(
        graph_id="g1",
        node_iri="urn:weave:x:1",
        position_x=1.5,
        position_y=-2.5,
        workspace_id="ws-1",
    )

    response = await save_position(body, principal)

    assert response.status_code == 204
    conn.execute.assert_awaited_once()
    sql, *params = conn.execute.call_args.args
    assert "INSERT INTO explorer_layout_positions" in sql
    assert "ON CONFLICT (tenant_id, workspace_id, graph_id, node_iri)" in sql
    assert params == [principal.tenant_id, "ws-1", "g1", "urn:weave:x:1", 1.5, -2.5]


async def test_save_position_returns_403_when_tenant_id_mismatches_jwt_claim() -> None:
    principal = _principal(tenant_id="3d6a8f2e-9b1c-4e5a-8f3d-1a2b3c4d5e6f")
    body = LayoutSaveRequest(
        graph_id="g1",
        node_iri="urn:weave:x:1",
        position_x=1.0,
        position_y=2.0,
        workspace_id="ws-1",
        tenant_id="00000000-0000-0000-0000-000000000000",
    )

    with pytest.raises(LayoutApiError) as exc_info:
        await save_position(body, principal)

    assert exc_info.value.status_code == 403
    assert exc_info.value.body == {"error": "forbidden"}


async def test_reset_layout_returns_204_with_no_body(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = _FakeConnection()
    _patch_layout_connection(monkeypatch, conn)
    principal = _principal()

    response = await reset_layout(principal, graph_id="g1", workspace_id="ws-1", tenant_id=None)

    assert response.status_code == 204
    assert response.body == b""
    conn.execute.assert_awaited_once()


async def test_get_positions_returns_workspace_scoped_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = _FakeConnection()
    conn.fetch = AsyncMock(
        return_value=[
            {"node_iri": "urn:weave:x:1", "position_x": 1.0, "position_y": 2.0, "locked": False}
        ]
    )
    _patch_layout_connection(monkeypatch, conn)
    principal = _principal()

    result = await get_positions(principal, graph_id="g1", workspace_id="ws-1", tenant_id=None)

    assert result.positions[0].node_iri == "urn:weave:x:1"
    assert result.positions[0].position_x == 1.0
