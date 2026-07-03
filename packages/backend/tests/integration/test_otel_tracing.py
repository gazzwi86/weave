"""AC-5: a real FastAPI request through the ASGI app emits an OTel span
carrying ``tenant_id``, ``engine``, and ``principal_iri`` — verified against
an in-memory exporter (Law F: no collector, no network).
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.observability.tracing import setup_tracing

pytestmark = pytest.mark.integration


@pytest.fixture
def exporter() -> InMemorySpanExporter:
    result = setup_tracing(app, testing=True)
    assert result is not None  # testing=True always returns the in-memory exporter
    return result


@pytest.fixture
async def client(exporter: InMemorySpanExporter) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_otel_span_has_required_attrs(
    client: AsyncClient, exporter: InMemorySpanExporter
) -> None:
    tokens = issue_token_pair(sub="dev-user-1", tenant_id="acme-corp")
    exporter.clear()

    response = await client.get(
        "/api/whoami",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 200
    spans = exporter.get_finished_spans()
    assert spans, "expected at least one span to be recorded"
    attrs = spans[-1].attributes or {}
    assert attrs.get("tenant_id") == "acme-corp"
    assert attrs.get("engine") == "platform"
    assert attrs.get("principal_iri") == "urn:weave:principal:dev-user-1"


async def test_health_request_still_gets_default_tenant_span(
    client: AsyncClient, exporter: InMemorySpanExporter
) -> None:
    exporter.clear()

    response = await client.get("/api/health")

    assert response.status_code == 200
    spans = exporter.get_finished_spans()
    attrs = spans[-1].attributes or {}
    assert attrs.get("tenant_id") == "system"
    assert attrs.get("engine") == "platform"
