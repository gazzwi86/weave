"""G15/ADR-023: the operator-console platform registry -- one row per
company (`tenants` table, migration 0085), deliberately not RLS'd. Mirrors
`tenancy/workspaces.py`'s shape (dataclass model, `*Taken` collision
exception on the unique-violation path) so the two read the same at a
glance.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime

import asyncpg

_SLUG_RE = re.compile(r"[^a-z0-9]+")


class TenantIdTaken(Exception):
    """Raised when the slugified `tenant_id` derived from a company name
    already exists -- same pattern as `WorkspaceSlugTaken`, no retry-suffix
    cleverness: the caller (operator) picks a different name.
    """


@dataclass(frozen=True)
class TenantRecord:
    tenant_id: str
    name: str
    industry: str
    region: str
    status: str
    created_at: datetime


def slugify_tenant_id(name: str) -> str:
    """`"Acme Corp!"` -> `"acme-corp"`. Falls back to `"tenant"` for a name
    that slugifies to nothing (e.g. all-punctuation) rather than minting an
    empty-string primary key.
    """
    slug = _SLUG_RE.sub("-", name.strip().lower()).strip("-")
    return slug or "tenant"


def _row_to_record(row: asyncpg.Record) -> TenantRecord:
    return TenantRecord(
        tenant_id=row["tenant_id"],
        name=row["name"],
        industry=row["industry"],
        region=row["region"],
        status=row["status"],
        created_at=row["created_at"],
    )


async def create_tenant(
    conn: asyncpg.Connection, *, name: str, industry: str, region: str
) -> TenantRecord:
    tenant_id = slugify_tenant_id(name)
    try:
        # False positive: static literal SQL; every value is bound as a
        # positional parameter, never interpolated into the query text.
        # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
        row = await conn.fetchrow(
            """
            INSERT INTO tenants (tenant_id, name, industry, region, status)
            VALUES ($1, $2, $3, $4, 'active')
            RETURNING tenant_id, name, industry, region, status, created_at
            """,
            tenant_id,
            name,
            industry,
            region,
        )
    except asyncpg.UniqueViolationError as exc:
        raise TenantIdTaken(tenant_id) from exc
    return _row_to_record(row)


async def get_tenant(conn: asyncpg.Connection, *, tenant_id: str) -> TenantRecord | None:
    row = await conn.fetchrow(
        "SELECT tenant_id, name, industry, region, status, created_at"
        " FROM tenants WHERE tenant_id = $1",
        tenant_id,
    )
    return _row_to_record(row) if row is not None else None


async def list_tenants(conn: asyncpg.Connection) -> list[TenantRecord]:
    rows = await conn.fetch(
        "SELECT tenant_id, name, industry, region, status, created_at"
        " FROM tenants ORDER BY created_at"
    )
    return [_row_to_record(row) for row in rows]


async def set_tenant_status(
    conn: asyncpg.Connection, *, tenant_id: str, status: str
) -> TenantRecord | None:
    row = await conn.fetchrow(
        "UPDATE tenants SET status = $2 WHERE tenant_id = $1"
        " RETURNING tenant_id, name, industry, region, status, created_at",
        tenant_id,
        status,
    )
    return _row_to_record(row) if row is not None else None
