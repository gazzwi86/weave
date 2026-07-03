"""Per-request tracing context (AC-5). Populated by
``TenantContextMiddleware`` (defaults) and overwritten by
``weave_backend.auth.dependencies.get_current_principal`` once a request is
authenticated. Each ASGI request runs in its own asyncio Task, so
``ContextVar`` values never leak between concurrent requests.
"""

from __future__ import annotations

from contextvars import ContextVar

#: Identifies which of the four Weave engines served this request. This
#: platform shell precedes all four, so it stamps its own constant.
ENGINE_NAME = "platform"

tenant_id_var: ContextVar[str | None] = ContextVar("tenant_id", default=None)
principal_iri_var: ContextVar[str | None] = ContextVar("principal_iri", default=None)
