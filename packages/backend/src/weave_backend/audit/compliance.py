"""AC-7: `GET /api/audit/compliance` aggregation. `diff_summary` never
appears in this response shape for anyone -- redaction is structural (the
shape has no field for it), not a role branch, so there's nothing for a
non-admin caller to leak.
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from weave_backend.audit.verify import verify_chain
from weave_backend.billing.period import current_period

_TOP_ACTORS_LIMIT = 5


@dataclass(frozen=True)
class ActorCount:
    principal_iri: str
    event_count: int


@dataclass(frozen=True)
class ComplianceSummary:
    period: str
    chain_status: str
    entries_checked: int
    first_broken_seq: int | None
    by_event_category: dict[str, int]
    top_actors: list[ActorCount]


def _event_category(event_type: str) -> str:
    return event_type.split(".", 1)[0]


async def get_compliance_summary(conn: asyncpg.Connection, tenant_id: str) -> ComplianceSummary:
    verify_result = await verify_chain(conn, tenant_id)

    category_rows = await conn.fetch(
        "SELECT event_type, COUNT(*) AS c FROM audit_entries WHERE tenant_id = $1"
        " GROUP BY event_type",
        tenant_id,
    )
    by_event_category: dict[str, int] = {}
    for row in category_rows:
        category = _event_category(row["event_type"])
        by_event_category[category] = by_event_category.get(category, 0) + int(row["c"])

    actor_rows = await conn.fetch(
        "SELECT actor_principal_iri, COUNT(*) AS c FROM audit_entries WHERE tenant_id = $1"
        " GROUP BY actor_principal_iri ORDER BY c DESC LIMIT $2",
        tenant_id,
        _TOP_ACTORS_LIMIT,
    )
    top_actors = [
        ActorCount(principal_iri=row["actor_principal_iri"], event_count=int(row["c"]))
        for row in actor_rows
    ]

    return ComplianceSummary(
        period=current_period(),
        chain_status="valid" if verify_result.valid else "broken",
        entries_checked=verify_result.entries_checked,
        first_broken_seq=verify_result.first_broken_seq,
        by_event_category=by_event_category,
        top_actors=top_actors,
    )
