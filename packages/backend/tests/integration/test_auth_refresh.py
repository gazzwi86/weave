"""AC-3: POST /api/auth/refresh proxies to the OIDC issuer's token endpoint.
Runs fully offline (Law F): the OIDC issuer dependency is overridden to an
in-process ASGI transport pointed at the mock OIDC app, never a real network
call.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.routers import auth as auth_router

pytestmark = pytest.mark.integration


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_refresh_rate_limit() -> None:
    # The store is a module-level dict shared for the process lifetime, and
    # mutmut runs the suite more than once in one process (stats pass, then
    # clean pass) -- without this, the second pass inherits the first pass's
    # request timestamps and trips the 5-per-60s ceiling with spurious 429s.
    auth_router._refresh_rate_limit_store.clear()


async def test_expired_jwt_triggers_refresh(client: AsyncClient) -> None:
    tokens = await issue_token_pair(sub="dev-user-1", tenant_id="acme-corp")

    response = await client.post(
        "/api/auth/refresh", json={"refresh_token": tokens.refresh_token}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["expires_in"] == 300  # ADR-001 real Cognito minimum, not the brief's 60s
    assert body["access_token"] != tokens.access_token


async def test_invalid_refresh_token_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/auth/refresh", json={"refresh_token": "not-a-real-token"})

    assert response.status_code == 401
    assert response.json()["detail"]["error"] == "invalid_refresh_token"


async def test_refresh_rejects_empty_body(client: AsyncClient) -> None:
    response = await client.post("/api/auth/refresh", json={"refresh_token": ""})

    assert response.status_code == 422


async def test_refresh_rate_limit_returns_429_after_default_limit(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Edge case (QA): Law 18's rate limiter is wired through a FastAPI
    dependency on this route -- test_rate_limit.py only proves the pure
    sliding-window function works in isolation. This proves the actual HTTP
    endpoint returns 429 once the shared per-client bucket is exhausted.
    Resets the module-level store first so this test doesn't inherit (or
    leave behind) request counts shared with the other tests in this file.
    """
    monkeypatch.setattr(auth_router, "_refresh_rate_limit_store", {})

    for _ in range(5):
        response = await client.post(
            "/api/auth/refresh", json={"refresh_token": "not-a-real-token"}
        )
        assert response.status_code == 401  # invalid token, but request was let through

    limited_response = await client.post(
        "/api/auth/refresh", json={"refresh_token": "not-a-real-token"}
    )

    assert limited_response.status_code == 429
    assert limited_response.json()["detail"]["error"] == "rate_limited"
