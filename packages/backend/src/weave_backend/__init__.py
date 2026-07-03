from fastapi import FastAPI

from weave_backend.auth.oidc_client import close_oidc_client
from weave_backend.auth.public import assert_all_routes_guarded, public
from weave_backend.db.pool import close_app_pool
from weave_backend.observability.middleware import install_tenant_context_middleware
from weave_backend.routers.auth import refresh
from weave_backend.routers.auth import router as auth_router
from weave_backend.routers.health import get_health
from weave_backend.routers.health import router as health_router
from weave_backend.routers.identity import router as identity_router
from weave_backend.routers.search import router as search_router
from weave_backend.routers.settings import router as settings_router
from weave_backend.routers.sparql import router as sparql_router
from weave_backend.routers.tenancy import router as tenancy_router

# AC-3 design decision: RBAC is dependency-by-default -- every route must
# either require `get_current_principal` or be explicitly marked `@public`.
# `/api/auth/refresh` mints a token from a still-valid refresh token (no
# principal yet to check); `/api/health` is an unauthenticated liveness
# probe. Both endpoint functions are defined in their own router modules, so
# they're marked here, once, rather than importing `public` into every
# router module for a single call site each.
public(get_health)
public(refresh)

app = FastAPI(title="Weave Platform API")
install_tenant_context_middleware(app)
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(tenancy_router)
app.include_router(settings_router)
app.include_router(sparql_router)
app.include_router(identity_router)
app.include_router(search_router)

assert_all_routes_guarded(app)


@app.on_event("shutdown")
async def _close_db_pool() -> None:
    await close_app_pool()
    await close_oidc_client()


def main() -> None:
    import uvicorn

    from weave_backend.observability.tracing import setup_tracing

    setup_tracing(app)
    uvicorn.run(app, host="0.0.0.0", port=8000)  # noqa: S104 -- dev entrypoint only
