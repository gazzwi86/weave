"""PLAT-TASK-004 cross-task ledger fix (a): JWKS caching in `auth/verify.py`.
A mocked `httpx.AsyncClient` transport stands in for the mock OIDC issuer's
`/jwks.json` -- true unit level, no live server needed.
"""

from __future__ import annotations

import time

import httpx
import jwt
import pytest

from weave_backend.auth import verify
from weave_backend.auth.verify import (
    TokenTtlExceeded,
    TokenVerificationError,
    _fetch_jwk_for_kid,
    verify_access_token,
)
from weave_backend.mock_oidc.keys import JWKS, KEY_ID, PRIVATE_KEY
from weave_backend.mock_oidc.tokens import AUDIENCE, ISSUER


def _client(*, calls: list[int] | None = None) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(1)
        return httpx.Response(200, json=JWKS)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://mock")


def _sign(*, principal_type: str = "human", lifetime: int = 60) -> dict[str, object]:
    now = int(time.time())
    return {
        "sub": "u1",
        "tenant_id": "acme",
        "principal_iri": "urn:weave:principal:user:u1",
        "principal_type": principal_type,
        "session_version": "0",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + lifetime,
    }


@pytest.fixture(autouse=True)
def _clear_jwk_cache() -> None:
    verify._jwk_cache.clear()


async def test_fetch_jwk_for_kid_caches_after_first_fetch() -> None:
    calls: list[int] = []
    client = _client(calls=calls)

    first = await _fetch_jwk_for_kid(client, KEY_ID)
    second = await _fetch_jwk_for_kid(client, KEY_ID)

    assert first == second
    assert len(calls) == 1  # second call served from cache, no second HTTP fetch


async def test_fetch_jwk_for_kid_unknown_kid_raises() -> None:
    client = _client()

    with pytest.raises(TokenVerificationError):
        await _fetch_jwk_for_kid(client, "no-such-kid")


async def test_verify_access_token_round_trip() -> None:
    token = jwt.encode(_sign(), PRIVATE_KEY, algorithm="RS256", headers={"kid": KEY_ID})

    claims = await verify_access_token(token, _client())

    assert claims["sub"] == "u1"
    assert claims["principal_type"] == "human"


async def test_verify_access_token_rejects_malformed_token() -> None:
    with pytest.raises(TokenVerificationError):
        await verify_access_token("not-a-jwt", _client())


async def test_verify_access_token_propagates_ttl_exceeded_distinctly() -> None:
    token = jwt.encode(
        _sign(principal_type="agent", lifetime=61), PRIVATE_KEY, algorithm="RS256",
        headers={"kid": KEY_ID},
    )

    with pytest.raises(TokenTtlExceeded):
        await verify_access_token(token, _client())
