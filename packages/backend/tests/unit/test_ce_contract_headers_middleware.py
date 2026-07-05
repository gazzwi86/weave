"""AC-003-14: every CE contract response carries `X-CE-Version` +
`X-Tenant-ID`. Raw ASGI middleware (see `TenantContextMiddleware`'s
docstring for why not `BaseHTTPMiddleware`) -- proved here against a
minimal isolated app, not the real `weave_backend.app` singleton, so the
contextvar state from other tests can never leak in.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from weave_backend.observability.context import tenant_id_var
from weave_backend.observability.middleware import (
    CE_API_VERSION,
    DEFAULT_TENANT_ID,
    install_ce_contract_headers_middleware,
)


def _build_app(*, set_tenant: str | None) -> FastAPI:
    app = FastAPI()

    @app.get("/probe")
    async def probe() -> dict[str, bool]:
        if set_tenant is not None:
            tenant_id_var.set(set_tenant)
        return {"ok": True}

    install_ce_contract_headers_middleware(app)
    return app


def test_response_carries_ce_version_and_the_real_tenant_id() -> None:
    client = TestClient(_build_app(set_tenant="tenant-42"))

    response = client.get("/probe")

    assert response.headers["X-CE-Version"] == CE_API_VERSION
    assert response.headers["X-Tenant-ID"] == "tenant-42"


def test_response_falls_back_to_default_tenant_when_unset() -> None:
    client = TestClient(_build_app(set_tenant=None))

    response = client.get("/probe")

    assert response.headers["X-Tenant-ID"] == DEFAULT_TENANT_ID
