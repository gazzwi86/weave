"""AC-8: growth-history snapshot (E2-S13). CE-METRICS-1 is point-in-time
only (m2-delta.md §4.4) -- the platform samples it into
`metrics_daily_snapshots` on each successful CE-METRICS-1 fetch (one
upsert per (tenant, day)), and the growth chart / stagnation advisory
render from the sampled series, never a re-derived history.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date

import asyncpg


@dataclass(frozen=True)
class GrowthSample:
    day: date
    entity_count: int


async def upsert_snapshot(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    day: date,
    counts_by_kind: dict[str, int],
) -> None:
    """One row per (tenant, day) -- a second fetch the same day updates the
    existing row in place rather than inserting a duplicate.
    """
    entity_count = sum(counts_by_kind.values())
    await conn.execute(
        """
        INSERT INTO metrics_daily_snapshots (tenant_id, day, entity_count, counts_by_kind)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (tenant_id, day) DO UPDATE
            SET entity_count = EXCLUDED.entity_count, counts_by_kind = EXCLUDED.counts_by_kind
        """,
        tenant_id,
        day,
        entity_count,
        json.dumps(counts_by_kind),
    )


async def growth_series(
    conn: asyncpg.Connection, *, tenant_id: str, window_days: int
) -> list[GrowthSample]:
    rows = await conn.fetch(
        """
        SELECT day, entity_count FROM metrics_daily_snapshots
        WHERE tenant_id = $1 AND day >= (CURRENT_DATE - $2::int)
        ORDER BY day ASC
        """,
        tenant_id,
        window_days,
    )
    return [GrowthSample(day=row["day"], entity_count=row["entity_count"]) for row in rows]


def stagnation_advisory(samples: list[GrowthSample], *, stagnation_days: int) -> bool:
    """AC-8: never fire on a young workspace -- need >= `stagnation_days`
    samples AND the most recent window flat-or-declining.
    """
    if len(samples) < stagnation_days:
        return False
    window = samples[-stagnation_days:]
    return window[-1].entity_count <= window[0].entity_count
