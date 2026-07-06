"""AC-1..AC-8: `POST /api/requests`, `GET /api/requests/{id}`,
`GET /api/requests/{id}/stream` (BE-TASK-003, build-engine EPIC-001,
Request Studio intake + AI spec drafting).
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Annotated

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse

from weave_backend.ai.providers import ModelProvider

# Re-exported under this module's own name (not just imported for internal
# use) so a test can `patch("weave_backend.routers.requests._select_provider",
# side_effect=...)` to simulate AC-8's "model unavailable" case without
# touching the real provider-selection logic in `ai/router.py`.
from weave_backend.ai.router import _select_provider
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.projects.ce_version_client import get_ce_client
from weave_backend.requests import store
from weave_backend.requests.pipeline import DraftingRequest, run_drafting_pipeline
from weave_backend.requests.store import RequestRecord
from weave_backend.schemas.requests import (
    ALLOWED_RUN_MODES,
    CreateRequestBody,
    CreateRequestResponse,
    RequestStatusResponse,
)

router = APIRouter(prefix="/api/requests", tags=["requests"])


async def get_ai_provider() -> ModelProvider | None:
    """Real requests get `None` here and fall back to `_select_provider()`
    inside the route (AC-8's synchronous 503 preflight); tests/integration
    override this dependency to inject a recording double instead.
    """
    return None


def _validate_body(body: CreateRequestBody) -> None:
    if body.run_mode not in ALLOWED_RUN_MODES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "validation_error",
                "field": "run_mode",
                "allowed": list(ALLOWED_RUN_MODES),
            },
        )
    if not body.prompt.strip():
        raise HTTPException(
            status_code=422, detail={"error": "validation_error", "field": "prompt"}
        )


@router.post("", status_code=202, response_model=CreateRequestResponse)
async def create_request_route(
    body: CreateRequestBody,
    background_tasks: BackgroundTasks,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[httpx.AsyncClient, Depends(get_ce_client)],
    provider: Annotated[ModelProvider | None, Depends(get_ai_provider)] = None,
) -> CreateRequestResponse:
    _validate_body(body)

    if provider is None:
        try:
            provider = _select_provider()
        except Exception as exc:  # any construction failure means "unavailable"
            raise HTTPException(status_code=503, detail={"error": "model_unavailable"}) from exc

    request_id = uuid.uuid4().hex
    redis_client = await store.get_redis_client()
    await store.create_request_record(
        redis_client,
        RequestRecord(
            request_id=request_id,
            tenant_id=principal.tenant_id,
            run_mode=body.run_mode,
            status="drafting",
            prompt=body.prompt,
            created_by_iri=principal.principal_iri,
        ),
    )
    background_tasks.add_task(
        run_drafting_pipeline,
        DraftingRequest(
            request_id=request_id,
            tenant_id=principal.tenant_id,
            actor_iri=principal.principal_iri,
            prompt=body.prompt,
        ),
        ce_client=ce_client,
        provider=provider,
    )
    return CreateRequestResponse(
        request_id=request_id, status="drafting", stream_url=f"/api/requests/{request_id}/stream"
    )


async def _get_record_or_404(request_id: str, tenant_id: str) -> RequestRecord:
    redis_client = await store.get_redis_client()
    record = await store.get_request_record(redis_client, request_id, tenant_id=tenant_id)
    if record is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return record


async def _update_record(request_id: str, **fields: object) -> None:
    redis_client = await store.get_redis_client()
    await store.update_request_record(redis_client, request_id, **fields)


@router.get("/{request_id}", response_model=RequestStatusResponse)
async def get_request_route(
    request_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> RequestStatusResponse:
    record = await _get_record_or_404(request_id, principal.tenant_id)
    return RequestStatusResponse(
        request_id=record.request_id,
        status=record.status,
        run_mode=record.run_mode,
        graph_context=record.graph_context,
        draft_content=record.draft_content,
        created_at=record.created_at,  # type: ignore[arg-type]
    )


@router.get("/{request_id}/stream")
async def stream_request_route(
    request_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> StreamingResponse:
    """AC-3/AC-4: replays every drafted-section event recorded so far, then
    polls for new ones until `done: true` (see `requests/store.py`'s
    module docstring for why this is a Redis list, not pub/sub).
    """
    await _get_record_or_404(request_id, principal.tenant_id)
    redis_client = await store.get_redis_client()

    async def _event_source() -> AsyncIterator[str]:
        async for event in store.subscribe_events(redis_client, request_id):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(_event_source(), media_type="text/event-stream")
