"""ONB-TASK-011: transactional outbox dispatcher draining `outbox` rows to
PLAT-NOTIFY-1 (ADR-003). Mirrors `operations/outbox.py`'s claim pattern
(conditional `UPDATE ... WHERE dispatched_at IS NULL RETURNING` + per-row
savepoint isolates one row's failure from the rest) with one addition:
`attempt_count` is bumped on failure for AC-011-04's backoff bookkeeping
(the audit outbox has no such column -- nothing there reads it back yet).

The in-app toast/checklist read the `activation` row directly (recorder.py
writes it in the same transaction as this outbox row), never this table --
a PLAT-NOTIFY-1 outage can only delay the outbound notify, never block or
duplicate the celebration (AC-011-04).
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable

import asyncpg

from weave_backend.notifications.dispatch import dispatch_notification
from weave_backend.notifications.store import NotificationEvent

log = logging.getLogger(__name__)

_SYSTEM_ACTOR_IRI = "urn:weave:system:onboarding"

Notifier = Callable[[asyncpg.Connection, NotificationEvent], Awaitable[None]]


async def _default_notifier(conn: asyncpg.Connection, event: NotificationEvent) -> None:
    await dispatch_notification(conn, event)


async def flush_pending(conn: asyncpg.Connection, *, notifier: Notifier = _default_notifier) -> int:
    """Delivers every pending row via `notifier`, marking each dispatched on
    success. A row whose delivery raises stays pending (attempt_count
    bumped) for the next flush -- never dropped, never blocks the rest.

    Returns the number of rows dispatched this call.
    """
    rows = await conn.fetch(
        "SELECT id, tenant_id, user_id, event_type, payload FROM outbox "
        "WHERE dispatched_at IS NULL ORDER BY created_at "
        "FOR UPDATE SKIP LOCKED"
    )
    dispatched = 0
    for row in rows:
        event = NotificationEvent(
            tenant_id=str(row["tenant_id"]),
            recipient_iri=str(row["user_id"]),
            event_type=str(row["event_type"]),
            payload=json.loads(row["payload"]),
            actor_iri=_SYSTEM_ACTOR_IRI,
        )
        try:
            async with conn.transaction():  # per-row savepoint
                claimed = await conn.fetchrow(
                    "UPDATE outbox SET dispatched_at = now() "
                    "WHERE id = $1 AND dispatched_at IS NULL RETURNING id",
                    row["id"],
                )
                if claimed is None:
                    continue  # a concurrent flush already dispatched this row
                await notifier(conn, event)
        except Exception:
            # AC-011-04: notify failure must never propagate or drop the
            # event; savepoint rolls the claim back too, so it stays
            # pending for next flush.
            await conn.execute(
                "UPDATE outbox SET attempt_count = attempt_count + 1 WHERE id = $1", row["id"]
            )
            log.warning(
                "onboarding outbox dispatch failed, will retry: id=%s", row["id"], exc_info=True
            )
            continue
        dispatched += 1
    return dispatched
