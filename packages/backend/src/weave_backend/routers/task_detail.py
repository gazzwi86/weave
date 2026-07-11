"""BE-V1-TASK-018 (build-engine EPIC-005): `GET /api/projects/{id}/tasks/{task_id}`
(AC-2/AC-4) and its `GET .../audit` proxy (AC-5). Read-only, thin wrappers
over `build.task_detail` -- same "route never touches the DB/FS beyond a
single lookup, service module owns assembly" split as `routers/decisions.py`.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.audit.decisions import AuditUnavailable, DecisionQuery, list_decisions
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.build.task_detail import (
    TaskRunFacts,
    get_task_detail,
    read_captures_manifest,
    read_console_log,
)
from weave_backend.db.pool import tenant_connection
from weave_backend.generation.store import get_latest_run_for_task
from weave_backend.schemas.task_detail import (
    ConsoleSourceResponse,
    TaskAuditEntryResponse,
    TaskAuditResponse,
    TaskDetailResponse,
)
from weave_backend.storage.tenant_objects import s3_client

router = APIRouter(prefix="/api/projects", tags=["projects"])

#: Same convention `run_log_sink.py`/`captures.py` write under -- the
#: producer never records its own manifest pointer anywhere else, so the
#: reader derives it (Design Decisions: "captures manifest convention, no
#: schema").
_ARTEFACT_BUCKET = "weave-artefacts"


async def _run_facts(
    conn: object, *, tenant_id: str, project_iri: str, task_id: str
) -> TaskRunFacts:
    latest = await get_latest_run_for_task(
        conn, tenant_id=tenant_id, project_iri=project_iri, task_id=task_id
    )
    if latest is None:
        return TaskRunFacts(
            run_status="unknown", run_id=None, log_location_ref=None, captures_manifest_ref=None
        )
    run_id, status, log_location_ref = latest
    captures_ref = (
        f"s3://{_ARTEFACT_BUCKET}/tenant/{tenant_id}/runs/{run_id}/captures/manifest.json"
    )
    return TaskRunFacts(
        run_status=status,
        run_id=run_id,
        log_location_ref=log_location_ref,
        captures_manifest_ref=captures_ref,
    )


@router.get("/{project_iri}/tasks/{task_id}", response_model=TaskDetailResponse)
async def get_task_detail_route(
    project_iri: str,
    task_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> TaskDetailResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        facts = await _run_facts(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri, task_id=task_id
        )
        detail = await get_task_detail(
            conn,
            tenant_id=principal.tenant_id,
            project_iri=project_iri,
            task_id=task_id,
            run_facts=facts,
        )
    return TaskDetailResponse(
        brief=detail.brief,
        handoff=detail.handoff,
        console=ConsoleSourceResponse(
            live_channel=detail.console.live_channel,
            log_location_ref=detail.console.log_location_ref,
        ),
        captures_manifest_ref=detail.captures_manifest_ref,
    )


@router.get("/{project_iri}/tasks/{task_id}/audit", response_model=TaskAuditResponse)
async def get_task_audit_route(
    project_iri: str,
    task_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> TaskAuditResponse:
    """AC-5: filtered proxy over PLAT-AUDIT-1 -- unreachable maps to a 503
    `audit_unavailable`, never a fabricated entry list.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            page = await list_decisions(
                conn,
                DecisionQuery(
                    tenant_id=principal.tenant_id,
                    project_iri=project_iri,
                    kind="all",
                    search=task_id,
                    cursor=None,
                ),
            )
        except AuditUnavailable as exc:
            raise HTTPException(status_code=503, detail={"error": "audit_unavailable"}) from exc

    return TaskAuditResponse(
        entries=[
            TaskAuditEntryResponse(
                seq=e.seq,
                ts=e.ts,
                actor_principal_iri=e.actor_principal_iri,
                event_type=e.event_type,
                target_iri=e.target_iri,
                diff_summary=e.diff_summary,
            )
            for e in page.entries
        ]
    )


@router.get("/{project_iri}/tasks/{task_id}/console-log")
async def get_task_console_log_route(
    project_iri: str,
    task_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> dict[str, str | None]:
    """AC-4 content read: thin GET over `build.task_detail.read_console_log`
    (already integration-tested against real LocalStack) -- the Console tab
    cannot read S3 from the browser directly, so this proxies the finished
    run's persisted log by `log_location_ref`.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        facts = await _run_facts(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri, task_id=task_id
        )
    if facts.log_location_ref is None:
        return {"log": None}
    log_text = await read_console_log(
        s3_client(), bucket=_ARTEFACT_BUCKET, log_location_ref=facts.log_location_ref
    )
    return {"log": log_text}


@router.get("/{project_iri}/tasks/{task_id}/captures")
async def get_task_captures_route(
    project_iri: str,
    task_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> dict[str, Any]:
    """AC-3 content read: thin GET over `build.task_detail.read_captures_manifest`
    -- honest `{"manifest": None}` when the manifest is missing (never a
    broken-image state), same posture as the reader itself.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        facts = await _run_facts(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri, task_id=task_id
        )
    if facts.captures_manifest_ref is None:
        return {"manifest": None}
    manifest = read_captures_manifest(
        s3_client(), bucket=_ARTEFACT_BUCKET, captures_manifest_ref=facts.captures_manifest_ref
    )
    return {"manifest": manifest}
