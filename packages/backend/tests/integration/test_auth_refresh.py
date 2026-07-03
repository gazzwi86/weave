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


async def test_expired_jwt_triggers_refresh(client: AsyncClient) -> None:
    tokens = issue_token_pair(sub="dev-user-1", tenant_id="acme-corp")

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
