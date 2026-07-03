"""AC-3 binding design decision: RBAC is dependency-by-default -- a route
opts out only via the explicit `@public` marker. `assert_all_routes_guarded`
is the enforcement check, run once at import time in `weave_backend/
__init__.py` so an unguarded route fails at startup, not in production.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import FastAPI
from fastapi.routing import APIRoute

from weave_backend.auth.dependencies import get_current_principal

_PUBLIC_ATTR = "__weave_public__"


def public[F: Callable[..., Any]](func: F) -> F:
    """Marks an endpoint function as deliberately unauthenticated."""
    setattr(func, _PUBLIC_ATTR, True)
    return func


def _iter_api_routes(router: Any) -> list[APIRoute]:
    """Recursively walks a router's `.routes`, descending into FastAPI
    0.139's `_IncludedRouter` wrapper -- `include_router` no longer flattens
    routes onto `app.routes` directly; they live one level down, on
    `.original_router.routes`.
    """
    routes: list[APIRoute] = []
    for route in router.routes:
        if isinstance(route, APIRoute):
            routes.append(route)
        elif hasattr(route, "original_router"):
            routes.extend(_iter_api_routes(route.original_router))
    return routes


def _depends_on_current_principal(route: APIRoute) -> bool:
    stack = list(route.dependant.dependencies)
    while stack:
        dependency = stack.pop()
        if dependency.call is get_current_principal:
            return True
        stack.extend(dependency.dependencies)
    return False


def assert_all_routes_guarded(app: FastAPI) -> None:
    """Raises `RuntimeError` naming the first route that is neither
    `@public` nor dependent (directly or transitively) on
    `get_current_principal`.
    """
    for route in _iter_api_routes(app.router):
        if getattr(route.endpoint, _PUBLIC_ATTR, False):
            continue
        if not _depends_on_current_principal(route):
            raise RuntimeError(
                f"route {route.path!r} is neither @public nor guarded by"
                " get_current_principal"
            )
