import os

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from weave_backend.auth.dependencies import UnauthorisedError, unauthorised_exception_handler
from weave_backend.auth.oidc_client import close_oidc_client
from weave_backend.auth.public import assert_all_routes_guarded, public
from weave_backend.briefs.ce_read_client import close_ce_read_client
from weave_backend.db.pool import close_app_pool
from weave_backend.deploy.ce_write_client import close_ce_write_client
from weave_backend.observability.middleware import (
    install_ce_contract_headers_middleware,
    install_tenant_context_middleware,
)
from weave_backend.projects.ce_version_client import close_ce_client
from weave_backend.requests.store import close_redis_client
from weave_backend.routers.audit import router as audit_router
from weave_backend.routers.auth import refresh
from weave_backend.routers.auth import router as auth_router
from weave_backend.routers.authoring import router as authoring_router
from weave_backend.routers.billing import harness_router as billing_harness_router
from weave_backend.routers.billing import router as billing_router
from weave_backend.routers.brand import router as brand_router
from weave_backend.routers.briefs import router as briefs_router
from weave_backend.routers.costs import router as costs_router
from weave_backend.routers.deploy import router as deploy_router
from weave_backend.routers.gates import router as gates_router
from weave_backend.routers.generation import router as generation_router
from weave_backend.routers.health import get_health
from weave_backend.routers.health import router as health_router
from weave_backend.routers.identity import router as identity_router
from weave_backend.routers.instances import router as instances_router
from weave_backend.routers.layout import LayoutApiError, layout_api_error_handler
from weave_backend.routers.layout import router as layout_router
from weave_backend.routers.notifications import router as notifications_router
from weave_backend.routers.ontology import router as ontology_router
from weave_backend.routers.operations import router as operations_router
from weave_backend.routers.project_bindings import router as project_bindings_router
from weave_backend.routers.project_contributors import router as project_contributors_router
from weave_backend.routers.project_pin import router as project_pin_router
from weave_backend.routers.project_settings import router as project_settings_router
from weave_backend.routers.projects import router as projects_router
from weave_backend.routers.query import router as query_router
from weave_backend.routers.request_governance import router as request_governance_router
from weave_backend.routers.requests import router as requests_router
from weave_backend.routers.runs import router as runs_router
from weave_backend.routers.search import router as search_router
from weave_backend.routers.settings import router as settings_router
from weave_backend.routers.source_control import router as source_control_router
from weave_backend.routers.sparql import router as sparql_router
from weave_backend.routers.specs import router as specs_router
from weave_backend.routers.standards import router as standards_router
from weave_backend.routers.tasks import router as tasks_router
from weave_backend.routers.tasks import tasks_validation_error_handler
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
install_ce_contract_headers_middleware(app)
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(authoring_router)
app.include_router(billing_router)
# QA blocker (PLAT-TASK-008): simulate-ai-call/simulate-run call the real
# ai_route() and incur real billed spend -- RBAC (author role) alone is not
# enough authorization for that. Gate at mount time, fail-closed: only "dev"
# and "test" mount the harness router, so an unset/misconfigured WEAVE_ENV in
# a real deploy never exposes it (the opposite failure mode of trusting an
# explicit opt-out). This is a one-time read at process/app-build time to
# decide static route registration, not a per-request env read inside
# business logic -- distinct from the WEAVE_TESTING pattern removed from
# src/ elsewhere in this codebase (see qa-cross-task-findings.md).
if os.environ.get("WEAVE_ENV") in ("dev", "test"):
    app.include_router(billing_harness_router)
app.include_router(tenancy_router)
app.include_router(settings_router)
app.include_router(sparql_router)
app.include_router(operations_router)
app.include_router(ontology_router)
app.include_router(brand_router)
app.include_router(identity_router)
app.include_router(instances_router)
app.include_router(search_router)
app.include_router(layout_router)
app.include_router(notifications_router)
app.include_router(audit_router)
app.include_router(projects_router)
app.include_router(project_contributors_router)
app.include_router(project_bindings_router)
app.include_router(project_settings_router)
app.include_router(project_pin_router)
app.include_router(source_control_router)
app.include_router(briefs_router)
app.include_router(costs_router)
app.include_router(generation_router)
app.include_router(deploy_router)
app.include_router(specs_router)
app.include_router(tasks_router)
app.include_router(query_router)
app.include_router(requests_router)
app.include_router(request_governance_router)
app.include_router(runs_router)
app.include_router(gates_router)
app.include_router(standards_router)
# tasks_validation_error_handler chains to projects_validation_error_handler
# (which falls back to FastAPI's default) for out-of-prefix paths, so a single
# registration covers /api/tasks, /api/projects, and everything else. Only one
# handler can be registered per exception class -- add_exception_handler
# overwrites, it does not chain -- hence the in-handler delegation.
app.add_exception_handler(RequestValidationError, tasks_validation_error_handler)
app.add_exception_handler(UnauthorisedError, unauthorised_exception_handler)

# TASK-004: narrow, this-router-only flat-error-body mechanism (see
# routers/layout.py's module docstring) -- does not affect any other
# router's existing (nested-under-`detail`) HTTPException behaviour.
app.add_exception_handler(LayoutApiError, layout_api_error_handler)

assert_all_routes_guarded(app)


@app.on_event("shutdown")
async def _close_db_pool() -> None:
    await close_app_pool()
    await close_oidc_client()
    await close_ce_client()
    await close_ce_read_client()
    await close_ce_write_client()
    await close_redis_client()


def main() -> None:
    import uvicorn

    from weave_backend.observability.tracing import setup_tracing

    setup_tracing(app)
    uvicorn.run(app, host="0.0.0.0", port=8000)  # noqa: S104 -- dev entrypoint only
