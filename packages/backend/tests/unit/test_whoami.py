from httpx import ASGITransport, AsyncClient

from weave_backend import app


async def test_whoami_without_bearer_token_is_unauthorized() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/whoami")

    assert response.status_code == 401
