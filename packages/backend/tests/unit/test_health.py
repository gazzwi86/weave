from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.routers import health as health_router


async def _get_health(client: AsyncClient) -> dict[str, Any]:
    response = await client.get("/api/health")
    assert response.status_code == 200
    return dict(response.json())


async def test_health_returns_ok_status_when_all_services_up(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(health_router, "check_postgres", _fake_ok)
    monkeypatch.setattr(health_router, "check_redis", _fake_ok)
    monkeypatch.setattr(health_router, "check_oxigraph", _fake_ok)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        body = await _get_health(client)

    assert body["status"] == "ok"
    assert body["services"] == {"postgres": "ok", "redis": "ok", "oxigraph": "ok"}
    assert "timestamp" in body


async def test_health_reports_degraded_when_a_service_is_down(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(health_router, "check_postgres", _fake_ok)
    monkeypatch.setattr(health_router, "check_redis", _fake_down)
    monkeypatch.setattr(health_router, "check_oxigraph", _fake_ok)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        body = await _get_health(client)

    assert body["status"] == "degraded"
    assert body["services"]["redis"] == "down"


async def _fake_ok() -> str:
    return "ok"


async def _fake_down() -> str:
    return "down"
