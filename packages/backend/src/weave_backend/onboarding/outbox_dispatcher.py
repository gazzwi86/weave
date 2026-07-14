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

# AC-011-04 backoff: attempt N waits BASE * 2**attempt_count seconds since
# created_at before being retried (capped), then gives up past MAX_ATTEMPTS.
# ponytail: attempt_count >= MAX_ATTEMPTS is the dead-letter marker (row
# just stays pending forever); add a real dead-letter table if these ever
# need manual triage.
BACKOFF_BASE_SECONDS = 30
BACKOFF_MAX_SECONDS = 3600
MAX_ATTEMPTS = 10

Notifier = Callable[[asyncpg.Connection, NotificationEvent], Awaitable[None]]


async def _default_notifier(conn: asyncpg.Connection, event: NotificationEvent) -> None:
    await dispatch_notification(conn, event)


async def flush_pending(
    conn: asyncpg.Connection, tenant_id: str, *, notifier: Notifier = _default_notifier
) -> int:
    """Delivers every pending, due `outbox` row for `tenant_id` via
    `notifier`, marking each dispatched on success. A row whose delivery
    raises stays pending (attempt_count bumped) for a later flush, gated by
    exponential backoff and a max-attempts cap -- never dropped, never
    blocks the rest.

    `tenant_id` is passed explicitly (not just RLS-inferred) so a silent RLS
    misconfiguration can't leak another tenant's rows into this drain.

    Returns the number of rows dispatched this call.
    """
    rows = await conn.fetch(
        "SELECT id, tenant_id, user_id, event_type, payload FROM outbox "
        "WHERE tenant_id = $1 AND dispatched_at IS NULL AND attempt_count < $2 "
        # attempt_count = 0 (never yet tried) always due -- backoff only
        # gates a *retry*, never the first attempt.
        "AND (attempt_count = 0 OR "
        "created_at <= now() - (LEAST($3 * 2 ^ attempt_count, $4) * interval '1 second')) "
        "ORDER BY created_at FOR UPDATE SKIP LOCKED",
        tenant_id,
        MAX_ATTEMPTS,
        BACKOFF_BASE_SECONDS,
        BACKOFF_MAX_SECONDS,
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
                    "WHERE id = $1 AND tenant_id = $2 AND dispatched_at IS NULL RETURNING id",
                    row["id"],
                    tenant_id,
                )
                if claimed is None:
                    continue  # a concurrent flush already dispatched this row
                await notifier(conn, event)
        except Exception:
            # AC-011-04: notify failure must never propagate or drop the
            # event; savepoint rolls the claim back too, so it stays
            # pending for a later flush (gated by the backoff above).
            await conn.execute(
                "UPDATE outbox SET attempt_count = attempt_count + 1 "
                "WHERE id = $1 AND tenant_id = $2",
                row["id"],
                tenant_id,
            )
            log.warning(
                "onboarding outbox dispatch failed, will retry: id=%s", row["id"], exc_info=True
            )
            continue
        dispatched += 1
    return dispatched
