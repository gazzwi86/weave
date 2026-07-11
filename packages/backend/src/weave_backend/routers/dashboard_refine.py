"""PLAT-V1-TASK-013: refine/restore/history routes. Split out from
`routers/dashboard.py` to stay under Law E's 300-line file cap -- same
router prefix/tags, included alongside it in `weave_backend/__init__.py`.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from httpx import AsyncClient

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.dashboard import refine, store
from weave_backend.dashboard.ce_metrics import CeMetricsUnavailable, get_ce_metrics_client
from weave_backend.dashboard.ce_metrics import fetch as fetch_ce_metric
from weave_backend.dashboard.generate import GenerateRequest, generate_widget_stream
from weave_backend.dashboard.intent import Resolver, get_dashboard_agent_resolver
from weave_backend.dashboard.status import WidgetFetchState, derive_status
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.dashboard import (
    GenerateWidgetRequest,
    HistoryResponse,
    HistoryStepOut,
    RestoreWidgetRequest,
    RestoreWidgetResponse,
)
from weave_backend.tenancy.sessions import get_redis

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


async def _owned_user_widget(
    conn: asyncpg.Connection, *, tenant_id: str, widget_id: str, principal: Principal
) -> store.WidgetRow:
    """AC-1/API Contracts: unknown id -> 404, `tenant_default`/non-owner ->
    403 -- deliberately NOT the IDOR-safe-404 shape `PATCH`/`DELETE` use
    (brief's API Contracts section states this explicitly).
    """
    row = await store.get_widget(conn, tenant_id=tenant_id, widget_id=widget_id)
    if row is None:
        raise HTTPException(status_code=404)
    if row.scope != "user" or row.owner_principal_iri != principal.principal_iri:
        raise HTTPException(status_code=403)
    return row


@router.post("/widgets/{widget_id}/refine")
async def refine_widget_route(
    widget_id: str,
    body: GenerateWidgetRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[AsyncClient, Depends(get_ce_metrics_client)],
    resolver: Annotated[Resolver, Depends(get_dashboard_agent_resolver)],
) -> StreamingResponse:
    """AC-1: refine is `generate_widget_stream` with `context`/
    `existing_widget_id` set -- same SSE grammar, budget gate, metering,
    and audit as TASK-011's generate (Design Decisions: zero
    re-implementation).
    """
    async with tenant_connection(principal.tenant_id) as conn:
        row = await _owned_user_widget(
            conn, tenant_id=principal.tenant_id, widget_id=widget_id, principal=principal
        )

    redis = get_redis()
    return StreamingResponse(
        generate_widget_stream(
            GenerateRequest(
                tenant_id=principal.tenant_id,
                principal_iri=principal.principal_iri,
                prompt=body.prompt,
                context=row.spec,
                existing_widget_id=widget_id,
            ),
            resolver=resolver,
            ce_client=ce_client,
            redis=redis,
        ),
        media_type="text/event-stream",
    )


@router.post("/widgets/{widget_id}/restore", response_model=RestoreWidgetResponse)
async def restore_widget_route(
    widget_id: str,
    body: RestoreWidgetRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[AsyncClient, Depends(get_ce_metrics_client)],
) -> RestoreWidgetResponse:
    """AC-4: restore never calls the model -- stored `resulting_spec` plus
    a plain data re-fetch (same honest-state derivation as
    `refresh_widget_route`), and is deliberately not appended to history.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        row = await _owned_user_widget(
            conn, tenant_id=principal.tenant_id, widget_id=widget_id, principal=principal
        )
        spec = await refine.get_refinement_spec(
            conn, tenant_id=principal.tenant_id, widget_id=widget_id, seq=body.seq
        )
        if spec is None:
            raise HTTPException(status_code=404)

        fetch_failed = False
        last_result = row.last_result
        fetched_at = row.fetched_at
        try:
            last_result = await fetch_ce_metric(ce_client, spec.bindings)
            fetched_at = store.utcnow()
        except CeMetricsUnavailable:
            fetch_failed = True

        derived = derive_status(
            spec_field=spec.bindings["field"],
            state=WidgetFetchState(
                last_result=last_result,
                fetched_at=fetched_at,
                refresh_interval_s=row.refresh_interval_s,
            ),
            fetch_failed=fetch_failed,
            now=store.utcnow(),
        )
        await refine.restore_widget_spec(
            conn,
            tenant_id=principal.tenant_id,
            widget_id=widget_id,
            outcome=refine.RestoreOutcome(
                spec=spec, last_result=last_result, fetched_at=fetched_at, status=derived.status
            ),
        )
    return RestoreWidgetResponse(spec=spec, status=derived.status, fetched_at=fetched_at)


@router.get("/widgets/{widget_id}/history", response_model=HistoryResponse)
async def widget_history_route(
    widget_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> HistoryResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        await _owned_user_widget(
            conn, tenant_id=principal.tenant_id, widget_id=widget_id, principal=principal
        )
        steps = await refine.list_history(conn, tenant_id=principal.tenant_id, widget_id=widget_id)
    return HistoryResponse(
        steps=[HistoryStepOut(seq=s.seq, prompt=s.prompt, created_at=s.created_at) for s in steps]
    )
