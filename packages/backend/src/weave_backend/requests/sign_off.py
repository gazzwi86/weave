"""Durable stakeholder sign-off records (BE-TASK-004, build-engine
EPIC-001) -- `request_sign_offs` table, migration `0011`.

Unlike Request Studio's ephemeral Redis-backed `RequestRecord` (ADR-001), a
sign-off is a governance record and belongs at the same durability tier as
`projects` (0009_projects.sql) -- see the task brief's own Diagram
References (`#sign-offs-table`) and ADR-002.
"""

from __future__ import annotations

import asyncpg
from pydantic import BaseModel


class SignOffFields(BaseModel):
    """Grouped input for `record_sign_off` -- keeps the function under Law
    E's 5-parameter budget (`tenant_id`/`request_id`/`stakeholder_iri`/
    `action`/`rejection_reason` would otherwise be 6 alongside `conn`).
    Mirrors `projects/model.py`'s `NewProject` precedent.
    """

    tenant_id: str
    request_id: str
    stakeholder_iri: str
    action: str
    rejection_reason: str | None = None


async def record_sign_off(conn: asyncpg.Connection, fields: SignOffFields) -> None:
    """Idempotent on `(request_id, stakeholder_iri)` (implementation hint)
    -- a double-submit from the same stakeholder overwrites their own row
    rather than erroring.
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        """
        INSERT INTO request_sign_offs
            (request_id, tenant_id, stakeholder_iri, action, rejection_reason)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (request_id, stakeholder_iri)
        DO UPDATE SET action = EXCLUDED.action,
                      rejection_reason = EXCLUDED.rejection_reason,
                      decided_at = now()
        """,
        fields.request_id,
        fields.tenant_id,
        fields.stakeholder_iri,
        fields.action,
        fields.rejection_reason,
    )


async def get_approved_stakeholder_iris(
    conn: asyncpg.Connection, *, tenant_id: str, request_id: str
) -> list[str]:
    """AC-5: every stakeholder IRI that has recorded an `"approved"` sign-off
    for `request_id` so far.
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    rows = await conn.fetch(
        """
        SELECT stakeholder_iri FROM request_sign_offs
        WHERE tenant_id = $1 AND request_id = $2 AND action = 'approved'
        """,
        tenant_id,
        request_id,
    )
    return [str(row["stakeholder_iri"]) for row in rows]
