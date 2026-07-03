from fastapi import FastAPI

from weave_backend.db.pool import close_app_pool
from weave_backend.observability.middleware import install_tenant_context_middleware
from weave_backend.routers.auth import router as auth_router
from weave_backend.routers.health import router as health_router
from weave_backend.routers.settings import router as settings_router
from weave_backend.routers.sparql import router as sparql_router
from weave_backend.routers.tenancy import router as tenancy_router

app = FastAPI(title="Weave Platform API")
install_tenant_context_middleware(app)
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(tenancy_router)
app.include_router(settings_router)
app.include_router(sparql_router)


@app.on_event("shutdown")
async def _close_db_pool() -> None:
    await close_app_pool()


def main() -> None:
    import uvicorn

    from weave_backend.observability.tracing import setup_tracing

    setup_tracing(app)
    uvicorn.run(app, host="0.0.0.0", port=8000)  # noqa: S104 -- dev entrypoint only
