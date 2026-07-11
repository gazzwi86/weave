"""TASK-025 unit tests: `/api/views*` routes, mocked DB (no docker) -- see
tests/integration/test_views_comments_persistence.py for the real-Aurora
RLS/atomicity proof. Mirrors test_layout_routes.py's direct-function-call
style.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal, RoleGrant
from weave_backend.routers.views import (
    create_view,
    delete_view,
    list_views,
    pin_view,
    share_view,
)
from weave_backend.schemas.views import PinRequest, ShareRequest, ViewCreateRequest, ViewPositionIn


def _principal(*, sub: str = "u-1", admin: bool = False) -> Principal:
    roles = [RoleGrant(scope="tenant", role="admin")] if admin else []
    return Principal(
        sub=sub, tenant_id="acme-corp", principal_iri=f"urn:weave:principal:user:{sub}", roles=roles
    )


class _FakeConnection:
    def __init__(self) -> None:
        self.execute = AsyncMock(return_value=None)
        self.fetch = AsyncMock(return_value=[])
        self.fetchrow = AsyncMock(return_value=None)
        self.fetchval = AsyncMock(return_value=0)


@asynccontextmanager
async def _fake_connection(conn: _FakeConnection) -> AsyncIterator[_FakeConnection]:
    yield conn


def _patch_connection(monkeypatch: pytest.MonkeyPatch, conn: _FakeConnection) -> None:
    monkeypatch.setattr(
        "weave_backend.routers.views.explorer_connection", lambda _tid: _fake_connection(conn)
    )


async def test_create_view_returns_400_when_name_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = _FakeConnection()
    _patch_connection(monkeypatch, conn)
    body = ViewCreateRequest(name=None, definition={"a": 1})

    with pytest.raises(HTTPException) as exc_info:
        await create_view(body, _principal())

    assert exc_info.value.status_code == 400


async def test_create_view_returns_409_with_existing_view_id_on_name_collision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    existing_id = uuid.uuid4()
    conn = _FakeConnection()
    conn.fetchrow = AsyncMock(return_value={"view_id": existing_id, "created_by": "urn:x"})
    _patch_connection(monkeypatch, conn)
    body = ViewCreateRequest(name="dup", definition={"a": 1}, overwrite=False)

    with pytest.raises(HTTPException) as exc_info:
        await create_view(body, _principal())

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["existing_view_id"] == str(existing_id)  # type: ignore[index]


async def test_create_view_marks_snapshot_rows_locked_true_under_view_graph_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    new_id = uuid.uuid4()
    conn = _FakeConnection()
    conn.fetchrow = AsyncMock(side_effect=[None, {"view_id": new_id}])
    _patch_connection(monkeypatch, conn)
    body = ViewCreateRequest(
        name="v1",
        definition={"a": 1},
        positions=[ViewPositionIn(node_iri="urn:weave:x:1", position_x=1.0, position_y=2.0)],
    )

    response = await create_view(body, _principal())

    assert response == {"view_id": str(new_id)}
    snapshot_call = conn.execute.call_args_list[-1]
    sql = snapshot_call.args[0]
    assert "INSERT INTO explorer_layout_positions" in sql
    assert "true" in sql  # locked = true literal, not a bound param
    assert f"view:{new_id}" in snapshot_call.args


async def test_delete_view_returns_404_when_no_row(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = _FakeConnection()
    _patch_connection(monkeypatch, conn)

    with pytest.raises(HTTPException) as exc_info:
        await delete_view(str(uuid.uuid4()), _principal())

    assert exc_info.value.status_code == 404


async def test_delete_view_returns_403_when_not_creator_or_admin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = _FakeConnection()
    conn.fetchrow = AsyncMock(return_value={"view_id": uuid.uuid4(), "created_by": "urn:other"})
    _patch_connection(monkeypatch, conn)

    with pytest.raises(HTTPException) as exc_info:
        await delete_view(str(uuid.uuid4()), _principal(sub="u-1"))

    assert exc_info.value.status_code == 403


async def test_delete_view_allows_tenant_admin_grant_to_delete_others_view(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = _FakeConnection()
    conn.fetchrow = AsyncMock(return_value={"view_id": uuid.uuid4(), "created_by": "urn:other"})
    _patch_connection(monkeypatch, conn)

    response = await delete_view(str(uuid.uuid4()), _principal(sub="u-admin", admin=True))

    assert response.status_code == 204


async def test_list_views_returns_tenant_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    view_id = uuid.uuid4()
    conn = _FakeConnection()
    conn.fetch = AsyncMock(
        return_value=[
            {
                "view_id": view_id,
                "name": "v1",
                "created_by": "urn:weave:principal:user:u-1",
                "pinned": False,
                "updated_at": __import__("datetime").datetime.now(),
            }
        ]
    )
    _patch_connection(monkeypatch, conn)

    result = await list_views(_principal())

    assert result[0].view_id == str(view_id)
    assert result[0].name == "v1"


async def test_pin_view_returns_403_when_not_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = _FakeConnection()
    _patch_connection(monkeypatch, conn)

    with pytest.raises(HTTPException) as exc_info:
        await pin_view(str(uuid.uuid4()), PinRequest(pinned=True), _principal(admin=False))

    assert exc_info.value.status_code == 403


async def test_share_view_computes_excluded_count_without_leaking_identities(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = _FakeConnection()
    conn.fetchrow = AsyncMock(return_value={"view_id": uuid.uuid4(), "created_by": "urn:x"})
    _patch_connection(monkeypatch, conn)
    monkeypatch.setattr(
        "weave_backend.routers.views.has_graph_access",
        AsyncMock(side_effect=[True, False]),
    )
    dispatch_mock = AsyncMock(return_value=uuid.uuid4())
    monkeypatch.setattr("weave_backend.routers.views.dispatch_notification", dispatch_mock)
    monkeypatch.setattr(
        "weave_backend.routers.views.tenant_connection", lambda _tid: _fake_connection(conn)
    )
    body = ShareRequest(recipients=["urn:weave:principal:user:in", "urn:weave:principal:user:out"])

    response = await share_view(str(uuid.uuid4()), body, _principal())

    assert response.notified == 1
    assert response.excluded == 1
    dispatch_mock.assert_awaited_once()


async def test_pin_view_returns_409_at_pin_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = _FakeConnection()
    conn.fetchrow = AsyncMock(return_value={"view_id": uuid.uuid4(), "created_by": "urn:x"})
    conn.fetchval = AsyncMock(return_value=5)
    _patch_connection(monkeypatch, conn)

    with pytest.raises(HTTPException) as exc_info:
        await pin_view(str(uuid.uuid4()), PinRequest(pinned=True), _principal(admin=True))

    assert exc_info.value.status_code == 409
