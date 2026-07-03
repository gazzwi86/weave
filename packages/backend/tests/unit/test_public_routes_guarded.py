"""PLAT-TASK-004 AC-3 binding design decision: RBAC is dependency-by-default,
not per-handler -- opting out requires an explicit ``@public`` marker.
``assert_all_routes_guarded`` is the enforcement mechanism; these tests pin
its behaviour directly (structural route-graph checks, no DB/network).
"""

from __future__ import annotations

from typing import Annotated

import pytest
from fastapi import APIRouter, Depends, FastAPI

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.auth.public import assert_all_routes_guarded, public


def test_real_app_passes_the_guard() -> None:
    """The actual app graph: every route is either `@public` or requires
    `get_current_principal`. Importing `weave_backend` already runs this
    check at module load (see `weave_backend/__init__.py`) -- this test
    re-runs it explicitly so a regression fails with a clear test name.
    """
    from weave_backend import app

    assert_all_routes_guarded(app)  # must not raise


def test_unguarded_route_fails_the_check() -> None:
    app = FastAPI()
    router = APIRouter()

    @router.get("/unsafe")
    async def unsafe() -> dict[str, bool]:
        return {"ok": True}

    app.include_router(router)

    with pytest.raises(RuntimeError, match="/unsafe"):
        assert_all_routes_guarded(app)


def test_public_marker_opts_a_route_out() -> None:
    app = FastAPI()
    router = APIRouter()

    @router.get("/health")
    @public
    async def health() -> dict[str, bool]:
        return {"ok": True}

    app.include_router(router)

    assert_all_routes_guarded(app)  # must not raise


def test_route_depending_on_get_current_principal_passes() -> None:
    app = FastAPI()
    router = APIRouter()

    @router.get("/protected")
    async def protected(
        principal: Annotated[Principal, Depends(get_current_principal)],
    ) -> dict[str, bool]:
        assert principal is not None
        return {"ok": True}

    app.include_router(router)

    assert_all_routes_guarded(app)  # must not raise
