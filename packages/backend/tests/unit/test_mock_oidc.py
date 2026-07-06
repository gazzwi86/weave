"""Unit coverage for the mock OIDC provider's authorization-code and
refresh-token grants — the auth E2E/integration tests build on top of this
working correctly, so it gets its own direct check.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import cast

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from httpx import ASGITransport, AsyncClient

from weave_backend.mock_oidc.app import app
from weave_backend.mock_oidc.keys import JWKS


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://mock-oidc") as ac:
        yield ac


async def test_authorize_form_defaults_to_seeded_admin_and_lists_demo_logins(
    client: AsyncClient,
) -> None:
    """FIX 1 (P0): the old default (`dev-user-1@weave.local`) has no seeded
    workspace membership, so logging in as it 400s every workspace-scoped
    route. The default must be a seeded user (`seed_demo.py`'s ADMIN), and
    the form must tell a human which demo logins exist so they aren't stuck
    guessing.
    """
    response = await client.get(
        "/authorize", params={"redirect_uri": "http://localhost:3000/callback"}
    )

    assert response.status_code == 200
    body = response.text
    assert 'value="admin@weave.local"' in body
    assert "admin@weave.local" in body and "super-admin" in body
    assert "client@weave.local" in body and "author" in body
    assert "acme-corp" in body


async def test_discovery_document_points_at_this_process(client: AsyncClient) -> None:
    response = await client.get("/.well-known/openid-configuration")

    assert response.status_code == 200
    body = response.json()
    assert body["token_endpoint"].endswith("/token")
    assert body["jwks_uri"].endswith("/jwks.json")


async def test_authorize_then_login_redirects_with_code(client: AsyncClient) -> None:
    response = await client.post(
        "/login",
        data={"redirect_uri": "http://localhost:3000/callback", "state": "xyz"},
        follow_redirects=False,
    )

    assert response.status_code == 303
    location = response.headers["location"]
    assert location.startswith("http://localhost:3000/callback?code=")
    assert "state=xyz" in location


async def test_full_code_grant_yields_verifiable_access_token(client: AsyncClient) -> None:
    login_response = await client.post(
        "/login",
        data={"redirect_uri": "http://localhost:3000/callback", "state": "xyz"},
        follow_redirects=False,
    )
    code = login_response.headers["location"].split("code=")[1].split("&")[0]

    token_response = await client.post(
        "/token", data={"grant_type": "authorization_code", "code": code}
    )

    assert token_response.status_code == 200
    body = token_response.json()
    key = cast(RSAPublicKey, jwt.algorithms.RSAAlgorithm.from_jwk(JWKS["keys"][0]))
    claims = jwt.decode(
        body["access_token"], key, algorithms=["RS256"], options={"verify_aud": False}
    )
    assert claims["tenant_id"] == "acme-corp"


async def test_reusing_a_code_is_rejected(client: AsyncClient) -> None:
    login_response = await client.post(
        "/login",
        data={"redirect_uri": "http://localhost:3000/callback", "state": "xyz"},
        follow_redirects=False,
    )
    code = login_response.headers["location"].split("code=")[1].split("&")[0]
    await client.post("/token", data={"grant_type": "authorization_code", "code": code})

    replay = await client.post("/token", data={"grant_type": "authorization_code", "code": code})

    assert replay.status_code == 400
    assert replay.json()["detail"]["error"] == "invalid_grant"


async def test_refresh_grant_issues_a_new_access_token(client: AsyncClient) -> None:
    login_response = await client.post(
        "/login",
        data={"redirect_uri": "http://localhost:3000/callback", "state": "xyz"},
        follow_redirects=False,
    )
    code = login_response.headers["location"].split("code=")[1].split("&")[0]
    first_response = await client.post(
        "/token", data={"grant_type": "authorization_code", "code": code}
    )
    first = first_response.json()

    refreshed = await client.post(
        "/token", data={"grant_type": "refresh_token", "refresh_token": first["refresh_token"]}
    )

    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"] != first["access_token"]


async def test_unknown_refresh_token_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/token", data={"grant_type": "refresh_token", "refresh_token": "bogus"}
    )

    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "invalid_grant"
