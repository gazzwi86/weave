"""AC-4: `verify_chain` fetches a tenant's full ordered chain and delegates
the actual re-computation to the pure `chain.verify_entries` -- this module
is only the Postgres I/O boundary, kept separate so the chain math stays
unit-testable without a database (see `tests/unit/test_audit_chain.py`).
"""

from __future__ import annotations

import json

import asyncpg

from weave_backend.audit.chain import AuditEntryRecord, VerifyResult, verify_entries
from weave_backend.audit.signing_key import get_signing_key


async def _fetch_ordered_entries(
    conn: asyncpg.Connection, tenant_id: str
) -> list[AuditEntryRecord]:
    rows = await conn.fetch(
        """
        SELECT seq, ts, tenant_id, actor_principal_iri, engine, event_type,
               target_iri, diff_summary, prev_hash, hash, signature
        FROM audit_entries
        WHERE tenant_id = $1
        ORDER BY seq ASC
        """,
        tenant_id,
    )
    return [
        AuditEntryRecord(
            seq=row["seq"],
            ts=row["ts"],
            tenant_id=row["tenant_id"],
            actor_principal_iri=row["actor_principal_iri"],
            engine=row["engine"],
            event_type=row["event_type"],
            target_iri=row["target_iri"],
            diff_summary=(
                json.loads(row["diff_summary"]) if row["diff_summary"] is not None else None
            ),
            prev_hash=row["prev_hash"],
            hash=row["hash"],
            signature=row["signature"],
        )
        for row in rows
    ]


async def verify_chain(conn: asyncpg.Connection, tenant_id: str) -> VerifyResult:
    """AC-4/AC-5: only ever checks the caller's own tenant chain -- the
    route layer is responsible for scoping `tenant_id` to the authenticated
    principal, never a caller-supplied value.
    """
    entries = await _fetch_ordered_entries(conn, tenant_id)
    private_key = await get_signing_key()
    return verify_entries(entries, private_key.public_key())
