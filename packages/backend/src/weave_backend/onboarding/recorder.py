"""ONB-TASK-011: the single exactly-once entry point for milestone
activation (ADR-003). TASK-010's self-mark and the poller (`poller.py`) are
the only callers -- nothing else touches the `activation` table (grep-style
enforcement lives in the module docstring, not code: the table's own
comment in migrations/0082_onboarding_state.sql names this function as the
sole writer).

`INSERT ... ON CONFLICT DO NOTHING RETURNING milestone_id` in the same
transaction as the outbox insert: a non-empty return IS the "winner" signal
that gates the outbox write. A conflicting (re-triggered) call returns
`None` and the transaction does nothing further -- exactly once per
(tenant, user, milestone), correctness resting on the DB constraint, not
application-level locking (ADR-003).
"""

from __future__ import annotations

import json
from typing import Literal

import asyncpg

MilestoneSource = Literal["poll", "event", "manual"]

_EVENT_TYPE = "onboarding-activation"


async def record_milestone(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    user_id: str,
    milestone_id: str,
    source: MilestoneSource,
) -> bool:
    """Returns `True` if this call won the insert (and thus wrote the
    outbox row); `False` if the milestone was already recorded -- no side
    effect on a loss (AC-011-02).
    """
    async with conn.transaction():
        won = await conn.fetchrow(
            "INSERT INTO activation (tenant_id, user_id, milestone_id, source, activated_at) "
            "VALUES ($1, $2, $3, $4, now()) "
            "ON CONFLICT DO NOTHING RETURNING milestone_id",
            tenant_id,
            user_id,
            milestone_id,
            source,
        )
        if won is None:
            return False
        await conn.execute(
            "INSERT INTO outbox (tenant_id, user_id, event_type, payload) "
            "VALUES ($1, $2, $3, $4::jsonb)",
            tenant_id,
            user_id,
            _EVENT_TYPE,
            json.dumps({"milestone_id": milestone_id, "source": source}),
        )
        return True
