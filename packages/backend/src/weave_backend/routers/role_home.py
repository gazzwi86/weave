"""PLAT-V1-TASK-017: `GET /api/role-home` -- role-tailored landing content
(E10-S1..S3). Composition-only: RBAC from M1, bindings from TASK-016,
SWR caching from TASK-010's `dashboard.store` (implementation hint: no new
data-fetching path grows here).
"""

from __future__ import annotations

from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends
from httpx import AsyncClient

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.dashboard import role_home, store
from weave_backend.dashboard.bindings import BindingContext, resolve_category
from weave_backend.dashboard.ce_metrics import get_ce_metrics_client
from weave_backend.dashboard.status import WidgetFetchState, derive_status
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.dashboard import WidgetOut
from weave_backend.schemas.role_home import (
    CompletenessRow,
    RoleHomeCapability,
    RoleHomeNextAction,
    RoleHomeResponse,
)

router = APIRouter(prefix="/api", tags=["role-home"])

#: Honest-empty payload for the one edge case with nothing ever cached and
#: CE unreachable on first load -- never a raised 500, never a fabricated
#: nonzero value.
_EMPTY_PAYLOAD: dict[str, Any] = {
    "kinds": [],
    "counts": {},
    "gaps": [],
    "draft_published_delta": 0,
    "shacl_by_severity": None,
    "unassigned_users": 0,
}


async def _fetch_kind_list(ctx: BindingContext) -> list[str] | None:
    """CE-READ-1: the authoritative kind list -- never a hand-copied one
    (ontology-standards.md); same `ctx.ce_client` round-trip pattern as
    `bindings._ontology_issues`'s `/api/ontology/versions` call.
    """
    try:
        response = await ctx.ce_client.get("/api/ontology/types", headers=ctx.ce_headers)
        response.raise_for_status()
    except httpx.HTTPError:
        return None
    return [kind["label"] for kind in response.json().get("kinds", [])]


async def _fetch_live_payload(ctx: BindingContext, level: str) -> dict[str, Any] | None:
    """AC-5: any source failure means "degrade to cache" -- never a partial
    live render mixed with stale fields.
    """
    health = await resolve_category("ontology-health", ctx)
    completeness = await resolve_category("completeness", ctx)
    kinds = await _fetch_kind_list(ctx)
    if health.status != "fresh" or completeness.status != "fresh" or kinds is None:
        return None
    shacl_by_severity = None
    if level in ("publish", "admin"):
        compliance = await resolve_category("compliance", ctx)
        if compliance.status not in ("fresh", "pending"):
            return None
        shacl_by_severity = (compliance.rows or {}).get("by_severity")
    unassigned_users = 0
    if level == "admin":
        rbac = await resolve_category("rbac-coverage", ctx)
        if rbac.status != "fresh":
            return None
        unassigned_users = len((rbac.rows or {}).get("users_without_role", []))
    return {
        "kinds": kinds,
        "counts": health.rows.get("entity_count_by_kind", {}),
        "gaps": completeness.rows.get("gaps", []),
        "draft_published_delta": health.rows.get("draft_published_delta", 0),
        "shacl_by_severity": shacl_by_severity,
        "unassigned_users": unassigned_users,
    }


async def _resolve_tile(
    conn: Any, principal: Principal, ctx: BindingContext, level: str
) -> tuple[dict[str, Any], WidgetOut]:
    """AC-5: lazy-create the tenant-wide tile, attempt a live fetch, and
    persist whichever payload (live or retained-cache) is honest -- one
    write path for both the success and degraded branches.
    """
    await store.ensure_role_home_tile(conn, tenant_id=principal.tenant_id)
    rows = await store.list_widgets(
        conn,
        tenant_id=principal.tenant_id,
        scope="role_home",
        owner_principal_iri=None,
    )
    assert len(rows) == 1, (  # noqa: S101 -- invariant: ensure_role_home_tile ran just above
        f"role_home tile missing for tenant {principal.tenant_id}"
    )
    tile = rows[0]
    payload = await _fetch_live_payload(ctx, level)
    fetch_failed = payload is None
    stored = payload if payload is not None else (tile.last_result or _EMPTY_PAYLOAD)
    derived = derive_status(
        spec_field="role_home_snapshot",
        state=WidgetFetchState(
            last_result=stored,
            fetched_at=tile.fetched_at,
            refresh_interval_s=tile.refresh_interval_s,
        ),
        fetch_failed=fetch_failed,
        now=store.utcnow(),
    )
    fetched_at = store.utcnow() if payload is not None else tile.fetched_at
    await store.apply_refresh_result(
        conn,
        tenant_id=principal.tenant_id,
        widget_id=tile.id,
        outcome=store.RefreshOutcome(
            last_result=stored, status=derived.status, fetched_at=fetched_at
        ),
    )
    tile_out = WidgetOut(
        id=tile.id,
        scope=tile.scope,  # type: ignore[arg-type]
        spec=tile.spec,
        position=tile.position,
        last_result=stored,
        fetched_at=fetched_at,
        status=derived.status,
        suggested=tile.suggested,
    )
    return stored, tile_out


def _summary_for_level(level: str, payload: dict[str, Any]) -> dict[str, Any]:
    counts = payload["counts"]
    summary: dict[str, Any] = {
        "kinds": len(payload["kinds"]),
        "instances": sum(v for v in counts.values() if isinstance(v, int | float)),
    }
    if level in ("author", "publish", "admin"):
        summary["draft_delta"] = payload.get("draft_published_delta", 0)
    if level in ("publish", "admin"):
        summary["shacl_errors"] = payload.get("shacl_by_severity")
        summary["coverage_gap_count"] = len(payload.get("gaps", []))
    return summary


def _build_response(level: str, payload: dict[str, Any], tile: WidgetOut) -> RoleHomeResponse:
    severity = payload.get("shacl_by_severity") or {}
    metrics = role_home.NextActionMetrics(
        shacl_violations=severity.get("violation", 0) if isinstance(severity, dict) else 0,
        coverage_gap_count=len(payload.get("gaps", [])),
        draft_published_delta=payload.get("draft_published_delta", 0),
        unassigned_users=payload.get("unassigned_users", 0),
    )
    capabilities = [
        RoleHomeCapability(**cap) for cap in role_home.capabilities_for_level(level)
    ] + [RoleHomeCapability(**row) for row in role_home.engine_gated_rows()]
    completeness = [
        CompletenessRow(**row)
        for row in role_home.completeness_map(
            kinds=payload["kinds"], counts=payload["counts"], gaps=payload["gaps"]
        )
    ]
    return RoleHomeResponse(
        capabilities=capabilities,
        summary=_summary_for_level(level, payload),
        next_action=RoleHomeNextAction(**role_home.next_action_rule(metrics, level)),
        completeness=completeness,
        tiles=[tile],
    )


@router.get("/role-home", response_model=RoleHomeResponse)
async def role_home_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[AsyncClient, Depends(get_ce_metrics_client)],
) -> RoleHomeResponse:
    level = role_home.authority_level([grant.role for grant in principal.roles])
    async with tenant_connection(principal.tenant_id) as conn:
        ctx = BindingContext(
            tenant_id=principal.tenant_id,
            context_iri=f"urn:weave:tenant:{principal.tenant_id}:company",
            conn=conn,
            ce_client=ce_client,
        )
        payload, tile_out = await _resolve_tile(conn, principal, ctx, level)
    return _build_response(level, payload, tile_out)
