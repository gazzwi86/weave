"""BE-V1-TASK-018 AC-2/AC-4/AC-5/AC-6: the Task Detail panel's read
assembly -- `GET /api/projects/{id}/tasks/{task_id}` and its `/audit`
proxy. Reuses existing stores directly (brief, dep-summary handoff, S3 run
log) rather than owning any new table (Design Decisions).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import asyncpg
from botocore.exceptions import BotoCoreError, ClientError

from weave_backend.audit.decisions import (
    AuditUnavailable,
    DecisionQuery,
    DecisionRecord,
    list_decisions,
)
from weave_backend.briefs.store import get_task_brief
from weave_backend.build.dep_summary import get_dep_summary


@dataclass(frozen=True)
class ConsoleSource:
    """AC-4: exactly one of `live_channel`/`log_location_ref` is set --
    a live run tails the SSE channel, a finished run reads its S3 pointer,
    an absent pointer on a finished run is honest absence.
    """

    live_channel: str | None
    log_location_ref: str | None


@dataclass(frozen=True)
class TaskDetail:
    brief: dict[str, Any] | None
    handoff: list[dict[str, Any]]
    console: ConsoleSource
    captures_manifest_ref: str | None


@dataclass(frozen=True)
class TaskRunFacts:
    """Grouped run-state facts the caller already has (Law E 5-param
    budget) -- `get_task_detail` never queries `generation_runs` itself.
    """

    run_status: str
    run_id: str | None
    log_location_ref: str | None
    captures_manifest_ref: str | None


def _console_source(
    *, run_status: str, run_id: str | None, log_location_ref: str | None
) -> ConsoleSource:
    """AC-4: a "live" run (anything not yet terminal) tails the existing
    run-status SSE channel; a finished run reads by `log_location_ref`
    (`None` when the sink never persisted -- "log not captured", not an
    error).
    """
    if run_status not in ("passed", "failed") and run_id is not None:
        return ConsoleSource(live_channel=f"/api/requests/{run_id}/stream", log_location_ref=None)
    return ConsoleSource(live_channel=None, log_location_ref=log_location_ref)


async def get_task_detail(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    project_iri: str,
    task_id: str,
    run_facts: TaskRunFacts,
) -> TaskDetail:
    """AC-2: assembles the Brief (typed YAML brief), Handoff (predecessors'
    dep summaries from the brief's `dep_chain.blocked_by`), and Console
    tabs' data. The Tests tab's captures pointer and Audit tab are resolved
    separately (captures ref is caller-supplied; Audit is its own proxy
    route, AC-5).
    """
    stored = await get_task_brief(conn, tenant_id=tenant_id, task_id=task_id)
    brief = stored.content if stored is not None else None

    handoff: list[dict[str, Any]] = []
    blocked_by = (brief or {}).get("dep_chain", {}).get("blocked_by", []) if brief else []
    for predecessor_id in blocked_by:
        summary = await get_dep_summary(
            conn, tenant_id=tenant_id, project_iri=project_iri, task_id=predecessor_id
        )
        if summary is not None:
            handoff.append(summary.model_dump())

    return TaskDetail(
        brief=brief,
        handoff=handoff,
        console=_console_source(
            run_status=run_facts.run_status,
            run_id=run_facts.run_id,
            log_location_ref=run_facts.log_location_ref,
        ),
        captures_manifest_ref=run_facts.captures_manifest_ref,
    )


async def resolve_brief_decision_link(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, adr_ref: str
) -> DecisionRecord | None:
    """AC-6: resolves a brief's ADR/decision reference (e.g. "ADR-017") to
    its Decision Log record -- a filtered search over the same
    `audit_entries` view the Decision Log panel reads (TASK-020), never a
    Build-side copy. Raises `AuditUnavailable` on the same failure class
    the Decision Log route maps to a 503.
    """
    page = await list_decisions(
        conn,
        DecisionQuery(
            tenant_id=tenant_id,
            project_iri=project_iri,
            kind="all",
            search=adr_ref,
            cursor=None,
        ),
    )
    return page.entries[0] if page.entries else None


async def read_console_log(s3_client: Any, *, bucket: str, log_location_ref: str) -> str | None:
    """AC-4: reads the finished-run console log by its S3 `log_location_ref`
    pointer. `None` on a read failure -- the caller renders "log not
    captured", never a broken page.
    """
    # `log_location_ref` is `s3://{bucket}/{key}` (RunLogSink's own format).
    key = log_location_ref.removeprefix(f"s3://{bucket}/")
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        return str(response["Body"].read().decode())
    except (BotoCoreError, ClientError):
        return None


def read_captures_manifest(
    s3_client: Any, *, bucket: str, captures_manifest_ref: str
) -> dict[str, Any] | None:
    """AC-3: reads `{output_location_ref}/captures/manifest.json`. `None`
    on a missing/unreadable manifest -- the Tests tab renders "captures not
    available", never broken images.
    """
    key = captures_manifest_ref.removeprefix(f"s3://{bucket}/")
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        parsed: dict[str, Any] = json.loads(response["Body"].read())
        return parsed
    except (BotoCoreError, ClientError):
        return None


__all__ = [
    "AuditUnavailable",
    "ConsoleSource",
    "TaskDetail",
    "get_task_detail",
    "read_captures_manifest",
    "read_console_log",
    "resolve_brief_decision_link",
]
