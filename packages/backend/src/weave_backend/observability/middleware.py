"""Sets default tracing-context values for every request before routing, and
stamps them onto the request's OTel span immediately (AC-5's engine +
principal_iri fallback + the default ``system`` tenant_id).

``auth.dependencies.get_current_principal`` re-stamps the span with the
real, verified tenant_id/principal_iri on protected routes -- it can't rely
on this middleware to pick that up automatically, because the OTel span for
a request ends as soon as the response finishes streaming (deep inside the
downstream call), which can happen before any of this middleware's
post-``call_next`` code would run. Stamping here happens before the
downstream call instead, so it only ever reflects the pre-route defaults.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import FastAPI
from opentelemetry import trace

from weave_backend.observability.context import principal_iri_var, tenant_id_var
from weave_backend.observability.tracing import add_tenant_attributes

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Receive, Scope, Send

DEFAULT_TENANT_ID = "system"
ANONYMOUS_PRINCIPAL_IRI = "urn:weave:anonymous"


class TenantContextMiddleware:
    """Raw ASGI middleware (not ``@app.middleware("http")``/BaseHTTPMiddleware,
    which runs the downstream app in a separate task with a copied context --
    that would make this middleware's context changes invisible to code
    further down the stack).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        tenant_id_var.set(DEFAULT_TENANT_ID)
        principal_iri_var.set(ANONYMOUS_PRINCIPAL_IRI)
        add_tenant_attributes(trace.get_current_span(), {})
        await self.app(scope, receive, send)


def install_tenant_context_middleware(app: FastAPI) -> None:
    app.add_middleware(TenantContextMiddleware)
