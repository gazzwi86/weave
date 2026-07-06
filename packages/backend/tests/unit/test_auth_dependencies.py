"""PLAT-TASK-004: `_bearer_token`'s missing/malformed-header branch -- the
rest of `get_current_principal` (JWT verify + session-revocation + TTL
ceiling) is exercised end-to-end by the integration suite (real DB, real
Redis), which is a truer test than mocking every collaborator here.
"""

from __future__ import annotations

import pytest
from fastapi import Request

from weave_backend.auth.dependencies import UnauthorisedError, _bearer_token


def _request_with_header(value: str | None) -> Request:
    headers = [(b"authorization", value.encode())] if value is not None else []
    return Request({"type": "http", "headers": headers})


def test_bearer_token_extracts_token_after_prefix() -> None:
    request = _request_with_header("Bearer abc.def.ghi")

    assert _bearer_token(request) == "abc.def.ghi"


def test_bearer_token_rejects_missing_header() -> None:
    request = _request_with_header(None)

    with pytest.raises(UnauthorisedError):
        _bearer_token(request)


def test_bearer_token_rejects_non_bearer_scheme() -> None:
    request = _request_with_header("Basic abc")

    with pytest.raises(UnauthorisedError):
        _bearer_token(request)
