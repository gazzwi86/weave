"""PLAT-TASK-004: `_bearer_token`'s missing/malformed-header branch -- the
rest of `get_current_principal` (JWT verify + session-revocation + TTL
ceiling) is exercised end-to-end by the integration suite (real DB, real
Redis), which is a truer test than mocking every collaborator here.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException, Request

from weave_backend.auth.dependencies import _bearer_token


def _request_with_header(value: str | None) -> Request:
    headers = [(b"authorization", value.encode())] if value is not None else []
    return Request({"type": "http", "headers": headers})


def test_bearer_token_extracts_token_after_prefix() -> None:
    request = _request_with_header("Bearer abc.def.ghi")

    assert _bearer_token(request) == "abc.def.ghi"


def test_bearer_token_rejects_missing_header() -> None:
    """AC-003-07: no-JWT-at-all rejects with the shared `{"error":
    "unauthorised"}` shape plus a `WWW-Authenticate: Bearer` challenge
    header -- every route depending on `get_current_principal` gets this
    for free, including the new CE-READ-1/CE-WRITE-1 routes.
    """
    request = _request_with_header(None)

    with pytest.raises(HTTPException) as exc_info:
        _bearer_token(request)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == {"error": "unauthorised"}  # type: ignore[comparison-overlap]
    assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}


def test_bearer_token_rejects_non_bearer_scheme() -> None:
    request = _request_with_header("Basic abc")

    with pytest.raises(HTTPException) as exc_info:
        _bearer_token(request)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == {"error": "unauthorised"}  # type: ignore[comparison-overlap]
    assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}
