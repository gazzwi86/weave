"""PR #90 review fixes (PLAT-V1-TASK-017): `_fetch_live_payload`'s
admin-only rbac-coverage branch must degrade the *whole* payload to None
on any non-fresh rbac result (AC-5 -- no partial live render), and must
never crash when a fresh result's `rows` is None.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

import httpx
import pytest
from httpx import MockTransport, Request, Response

from weave_backend.dashboard.bindings import BindingContext, BindingResult
from weave_backend.routers import role_home as role_home_router


def _ce_stub() -> httpx.AsyncClient:
    def _handler(request: Request) -> Response:
        if request.url.path == "/api/ontology/types":
            return Response(200, json={"kinds": [{"label": "Process"}]})
        return Response(404)

    return httpx.AsyncClient(transport=MockTransport(_handler), base_url="http://ce-metrics")


def _ctx() -> BindingContext:
    return BindingContext(
        tenant_id="t-1",
        context_iri="urn:weave:tenant:t-1:company",
        conn=None,
        ce_client=_ce_stub(),
    )


_FRESH_HEALTH = BindingResult(shape="kpi", status="fresh", rows={"entity_count_by_kind": {}})
_FRESH_COMPLETENESS = BindingResult(shape="matrix", status="fresh", rows={"gaps": []})
_FRESH_COMPLIANCE = BindingResult(shape="matrix", status="fresh", rows={"by_severity": {}})


def _resolve_category_stub(
    rbac_result: BindingResult,
) -> Callable[[str, BindingContext], Awaitable[BindingResult]]:
    async def _fake(name: str, ctx: BindingContext) -> BindingResult:
        return {
            "ontology-health": _FRESH_HEALTH,
            "completeness": _FRESH_COMPLETENESS,
            "compliance": _FRESH_COMPLIANCE,
            "rbac-coverage": rbac_result,
        }[name]

    return _fake


@pytest.mark.asyncio
async def test_fetch_live_payload_admin_rbac_not_fresh_degrades_whole_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Review finding #1: a non-fresh rbac result must degrade the entire
    payload to None (cached snapshot), never continue with
    `unassigned_users=0` standing in for real data.
    """
    stale_rbac = BindingResult(shape="matrix", status="stale", rows=None)
    monkeypatch.setattr(
        role_home_router, "resolve_category", _resolve_category_stub(stale_rbac)
    )

    result = await role_home_router._fetch_live_payload(_ctx(), "admin")

    assert result is None


@pytest.mark.asyncio
async def test_fetch_live_payload_admin_rbac_fresh_none_rows_no_crash(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Review finding #2: a fresh rbac result with `rows=None`
    (`BindingResult.rows` defaults to None) must not crash -- treated as
    zero unassigned users, not an AttributeError.
    """
    fresh_but_empty_rbac = BindingResult(shape="matrix", status="fresh", rows=None)
    monkeypatch.setattr(
        role_home_router, "resolve_category", _resolve_category_stub(fresh_but_empty_rbac)
    )

    result = await role_home_router._fetch_live_payload(_ctx(), "admin")

    assert result is not None
    assert result["unassigned_users"] == 0


def test_as_int_coerces_pending_sentinel_to_zero() -> None:
    """The /api/role-home 500 regression: CE-METRICS-1 metrics arrive as a
    `{"pending": true}` sentinel dict until computed. `next_action_rule`
    compares them with `>`, so a non-int must degrade to 0 rather than crash
    the whole response with `dict > int` (seen live on GET /api/role-home).
    """
    assert role_home_router._as_int({"pending": True}) == 0
    assert role_home_router._as_int(None) == 0
    assert role_home_router._as_int("7") == 0
    assert role_home_router._as_int(True) == 0  # bool is not a real count
    assert role_home_router._as_int(0) == 0
    assert role_home_router._as_int(5) == 5
