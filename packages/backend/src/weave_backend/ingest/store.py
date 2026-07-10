"""CE-V1-TASK-012: `ingest_jobs`/`ingest_proposals` persistence (migration
0040). Tenant-scoped via `tenant_connection()` -- RLS enforces isolation at
the DB level (docker-integration backstop test); the explicit `tenant_id`
filter here is defence-in-depth, same convention as `briefs/store.py`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import asyncpg


@dataclass(frozen=True)
class NewJob:
    """Grouped input for `insert_job` (Law E params<=5 budget)."""

    tenant_id: str
    workspace_id: str
    artefact_iri: str
    kind: str
    context: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class JobRow:
    id: str
    tenant_id: str
    workspace_id: str
    artefact_iri: str
    kind: str
    status: str
    context: dict[str, Any]
    activity_iri: str | None
    extractor_iri: str | None
    error: str | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class JobStatusUpdate:
    """Grouped input for `update_job_status` (Law E params<=5 budget)."""

    tenant_id: str
    job_id: str
    status: str
    activity_iri: str | None = None
    extractor_iri: str | None = None
    error: str | None = None


@dataclass(frozen=True)
class NewProposal:
    """Grouped input for `insert_proposal` (Law E params<=5 budget)."""

    tenant_id: str
    job_id: str
    ops: list[dict[str, Any]]
    confidence: float
    matched_iri: str | None = None
    reason: str = ""


@dataclass(frozen=True)
class ProposalRow:
    id: str
    tenant_id: str
    job_id: str
    ops: list[dict[str, Any]]
    confidence: float
    matched_iri: str | None
    reason: str
    status: str
    created_at: datetime


def _to_job_row(row: asyncpg.Record) -> JobRow:
    context = row["context"]
    return JobRow(
        id=str(row["id"]),
        tenant_id=row["tenant_id"],
        workspace_id=row["workspace_id"],
        artefact_iri=row["artefact_iri"],
        kind=row["kind"],
        status=row["status"],
        context=json.loads(context) if isinstance(context, str) else context,
        activity_iri=row["activity_iri"],
        extractor_iri=row["extractor_iri"],
        error=row["error"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _to_proposal_row(row: asyncpg.Record) -> ProposalRow:
    ops = row["ops"]
    return ProposalRow(
        id=str(row["id"]),
        tenant_id=row["tenant_id"],
        job_id=str(row["job_id"]),
        ops=json.loads(ops) if isinstance(ops, str) else ops,
        confidence=float(row["confidence"]),
        matched_iri=row["matched_iri"],
        reason=row["reason"],
        status=row["status"],
        created_at=row["created_at"],
    )


async def insert_job(conn: asyncpg.Connection, fields: NewJob) -> str:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        """
        INSERT INTO ingest_jobs (tenant_id, workspace_id, artefact_iri, kind, context)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING id
        """,
        fields.tenant_id,
        fields.workspace_id,
        fields.artefact_iri,
        fields.kind,
        json.dumps(fields.context),
    )
    return str(row["id"])  # INSERT ... RETURNING always yields a row


async def get_job(conn: asyncpg.Connection, *, tenant_id: str, job_id: str) -> JobRow | None:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        """
        SELECT id, tenant_id, workspace_id, artefact_iri, kind, status, context,
               activity_iri, extractor_iri, error, created_at, updated_at
        FROM ingest_jobs WHERE tenant_id = $1 AND id = $2
        """,
        tenant_id,
        job_id,
    )
    return _to_job_row(row) if row is not None else None


async def update_job_status(conn: asyncpg.Connection, fields: JobStatusUpdate) -> None:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        """
        UPDATE ingest_jobs
        SET status = $3,
            activity_iri = COALESCE($4, activity_iri),
            extractor_iri = COALESCE($5, extractor_iri),
            error = COALESCE($6, error),
            updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        """,
        fields.tenant_id,
        fields.job_id,
        fields.status,
        fields.activity_iri,
        fields.extractor_iri,
        fields.error,
    )


async def insert_proposal(conn: asyncpg.Connection, fields: NewProposal) -> str:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        """
        INSERT INTO ingest_proposals (tenant_id, job_id, ops, confidence, matched_iri, reason)
        VALUES ($1, $2, $3::jsonb, $4, $5, $6)
        RETURNING id
        """,
        fields.tenant_id,
        fields.job_id,
        json.dumps(fields.ops),
        fields.confidence,
        fields.matched_iri,
        fields.reason,
    )
    return str(row["id"])  # INSERT ... RETURNING always yields a row


async def get_proposal(
    conn: asyncpg.Connection, *, tenant_id: str, proposal_id: str
) -> ProposalRow | None:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        """
        SELECT id, tenant_id, job_id, ops, confidence, matched_iri, reason, status, created_at
        FROM ingest_proposals WHERE tenant_id = $1 AND id = $2
        """,
        tenant_id,
        proposal_id,
    )
    return _to_proposal_row(row) if row is not None else None


async def list_proposals_for_job(
    conn: asyncpg.Connection, *, tenant_id: str, job_id: str, limit: int = 50, offset: int = 0
) -> list[ProposalRow]:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    rows = await conn.fetch(
        """
        SELECT id, tenant_id, job_id, ops, confidence, matched_iri, reason, status, created_at
        FROM ingest_proposals WHERE tenant_id = $1 AND job_id = $2
        ORDER BY created_at ASC LIMIT $3 OFFSET $4
        """,
        tenant_id,
        job_id,
        limit,
        offset,
    )
    return [_to_proposal_row(row) for row in rows]


async def proposal_statuses_for_job(
    conn: asyncpg.Connection, *, tenant_id: str, job_id: str
) -> list[str]:
    """Feeds `ingest.jobs.summarize_proposal_statuses` for the job-status endpoint."""
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    rows = await conn.fetch(
        "SELECT status FROM ingest_proposals WHERE tenant_id = $1 AND job_id = $2",
        tenant_id,
        job_id,
    )
    return [row["status"] for row in rows]


async def update_proposal_status(
    conn: asyncpg.Connection, *, tenant_id: str, proposal_id: str, status: str
) -> None:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        "UPDATE ingest_proposals SET status = $3 WHERE tenant_id = $1 AND id = $2",
        tenant_id,
        proposal_id,
        status,
    )
