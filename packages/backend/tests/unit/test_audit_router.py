"""G6: `GET /api/audit/counts` must be gated the same as `GET /api/audit`
(tenant-admin-only) -- proven via route/dependency introspection (no real DB
needed), mirroring `test_project_pin_router.py`'s established precedent.
`require_tenant_admin` is a single fixed dependency (not a per-route
parametrized closure factory), so an identity check on `dep.call` suffices --
no freevar-matching workaround needed here.
"""

from __future__ import annotations

from fastapi.routing import APIRoute

from weave_backend.rbac import require_tenant_admin
from weave_backend.routers.audit import router


def _dependency_calls(path: str, method: str) -> list[object]:
    for route in router.routes:
        if not isinstance(route, APIRoute):
            continue
        methods = route.methods or set()
        if route.path == path and method in methods:
            return [dep.call for dep in route.dependant.dependencies]
    raise AssertionError(f"no route registered for {method} {path}")


def test_counts_route_requires_tenant_admin() -> None:
    assert require_tenant_admin in _dependency_calls("/api/audit/counts", "GET")


def test_list_route_requires_tenant_admin() -> None:
    # Existing route, asserted here too so a future refactor that
    # accidentally drops the guard on either route fails loudly.
    assert require_tenant_admin in _dependency_calls("/api/audit", "GET")
