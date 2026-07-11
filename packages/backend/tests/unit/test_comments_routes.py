"""TASK-025 unit tests: `/api/comments*` routes, mocked DB (no docker) -- see
tests/integration/test_views_comments_persistence.py for the real-Aurora
RLS proof. Mirrors test_views_routes.py's direct-function-call style.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.routers.comments import create_comment, list_comments
from weave_backend.schemas.comments import CommentCreateRequest


def _principal(*, sub: str = "u-1") -> Principal:
    return Principal(
        sub=sub, tenant_id="acme-corp", principal_iri=f"urn:weave:principal:user:{sub}", roles=[]
    )


class _FakeConnection:
    def __init__(self) -> None:
        self.execute = AsyncMock(return_value=None)
        self.fetch = AsyncMock(return_value=[])
        self.fetchrow = AsyncMock(return_value=None)


@asynccontextmanager
async def _fake_connection(conn: _FakeConnection) -> AsyncIterator[_FakeConnection]:
    yield conn


def _patch_connection(monkeypatch: pytest.MonkeyPatch, conn: _FakeConnection) -> None:
    monkeypatch.setattr(
        "weave_backend.routers.comments.explorer_connection", lambda _tid: _fake_connection(conn)
    )


async def test_create_comment_rejects_client_supplied_author_with_400(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = _FakeConnection()
    _patch_connection(monkeypatch, conn)
    body = CommentCreateRequest.model_validate(
        {
            "target_kind": "node",
            "target_ref": "urn:weave:entity:x",
            "body": "hi",
            "author": "urn:weave:spoof",
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        await create_comment(body, _principal())

    assert exc_info.value.status_code == 400
    conn.fetchrow.assert_not_awaited()


async def test_create_comment_rejects_empty_body_with_400(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = _FakeConnection()
    _patch_connection(monkeypatch, conn)
    body = CommentCreateRequest(target_kind="node", target_ref="urn:weave:entity:x", body="")

    with pytest.raises(HTTPException) as exc_info:
        await create_comment(body, _principal())

    assert exc_info.value.status_code == 400


async def test_create_comment_rejects_invalid_target_kind_with_422(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = _FakeConnection()
    _patch_connection(monkeypatch, conn)
    body = CommentCreateRequest(target_kind="bogus", target_ref="urn:weave:entity:x", body="hi")

    with pytest.raises(HTTPException) as exc_info:
        await create_comment(body, _principal())

    assert exc_info.value.status_code == 422


async def test_create_comment_stamps_author_from_principal_claim(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    comment_id = uuid.uuid4()
    conn = _FakeConnection()
    conn.fetchrow = AsyncMock(return_value={"comment_id": comment_id})
    _patch_connection(monkeypatch, conn)
    body = CommentCreateRequest(target_kind="node", target_ref="urn:weave:entity:x", body="hi")

    response = await create_comment(body, _principal(sub="u-author"))

    assert response == {"comment_id": str(comment_id)}
    call_args = conn.fetchrow.call_args.args
    assert call_args[4] == "urn:weave:principal:user:u-author"


async def test_list_comments_returns_tenant_rows_for_target(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    comment_id = uuid.uuid4()
    conn = _FakeConnection()
    conn.fetch = AsyncMock(
        return_value=[
            {
                "comment_id": comment_id,
                "target_kind": "node",
                "target_ref": "urn:weave:entity:x",
                "author": "urn:weave:principal:user:u-1",
                "body": "hi",
                "created_at": datetime.now(UTC),
            }
        ]
    )
    _patch_connection(monkeypatch, conn)

    result = await list_comments(_principal(), target_kind="node", target_ref="urn:weave:entity:x")

    assert result[0].comment_id == str(comment_id)
    assert result[0].body == "hi"


async def test_list_comments_returns_400_when_target_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = _FakeConnection()
    _patch_connection(monkeypatch, conn)

    with pytest.raises(HTTPException) as exc_info:
        await list_comments(_principal(), target_kind="", target_ref="")

    assert exc_info.value.status_code == 400
