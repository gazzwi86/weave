"""DB access for the notification store and per-user preferences
(PLAT-NOTIFY-1). Every query is tenant + recipient scoped; RLS
(migrations/0003_notifications.sql) is the belt-and-braces backstop, same
pattern as settings/audit_events.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import asyncpg
from pydantic import BaseModel


class BadRequest(Exception):
    def __init__(self, error: str) -> None:
        self.error = error
        super().__init__(error)


class NotificationRecord(BaseModel):
    id: str
    event_type: str
    payload: dict[str, Any]
    delivered_channels: list[str]
    read: bool
    created_at: datetime


@dataclass(frozen=True)
class NotificationEvent:
    """The one shape any engine (billing, audit, build, ...) hands to
    `dispatch_notification` -- bundled so the dispatch/insert/retry call
    chain stays within the 5-argument budget (Law E) as more callers land.
    """

    tenant_id: str
    recipient_iri: str
    event_type: str
    payload: dict[str, Any]
    actor_iri: str


@dataclass(frozen=True)
class NotificationQuery:
    tenant_id: str
    recipient_iri: str
    unread_only: bool = False
    page: int = 1
    per_page: int = 25


def _load_payload(value: Any) -> dict[str, Any]:
    parsed: dict[str, Any] = json.loads(value) if isinstance(value, str) else value
    return parsed


async def insert_notification(
    conn: asyncpg.Connection,
    *,
    notif_id: uuid.UUID,
    event: NotificationEvent,
    delivered_channels: list[str],
) -> None:
    # False positive: static literal SQL; every value is bound as a
    # positional parameter, never interpolated into the query text.
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        """
        INSERT INTO notifications
            (id, tenant_id, recipient_iri, event_type, payload, delivered_channels, read)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, false)
        """,
        notif_id,
        event.tenant_id,
        event.recipient_iri,
        event.event_type,
        json.dumps(event.payload),
        delivered_channels,
    )


async def append_delivered_channel(
    conn: asyncpg.Connection, *, notif_id: uuid.UUID, channel: str
) -> None:
    await conn.execute(
        """
        UPDATE notifications
        SET delivered_channels = array_append(delivered_channels, $2)
        WHERE id = $1 AND NOT ($2 = ANY(delivered_channels))
        """,
        notif_id,
        channel,
    )


_SELECT_ALL_SQL = """
    SELECT id, event_type, payload, delivered_channels, read, created_at
    FROM notifications
    WHERE tenant_id = $1 AND recipient_iri = $2
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4
"""

_SELECT_UNREAD_SQL = """
    SELECT id, event_type, payload, delivered_channels, read, created_at
    FROM notifications
    WHERE tenant_id = $1 AND recipient_iri = $2 AND read = false
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4
"""

_COUNT_ALL_SQL = (
    "SELECT count(*) AS total FROM notifications WHERE tenant_id = $1 AND recipient_iri = $2"
)

_COUNT_UNREAD_SQL = (
    "SELECT count(*) AS total FROM notifications"
    " WHERE tenant_id = $1 AND recipient_iri = $2 AND read = false"
)


async def list_notifications(
    conn: asyncpg.Connection, query: NotificationQuery
) -> tuple[list[NotificationRecord], int]:
    """AC-2: paginated, most-recent first -- `unread_only` picks one of two
    fully-literal queries (no interpolated SQL) so there's no dynamic-SQL
    vector to reason about.
    """
    select_sql = _SELECT_UNREAD_SQL if query.unread_only else _SELECT_ALL_SQL
    count_sql = _COUNT_UNREAD_SQL if query.unread_only else _COUNT_ALL_SQL
    rows = await conn.fetch(
        select_sql,
        query.tenant_id,
        query.recipient_iri,
        query.per_page,
        (query.page - 1) * query.per_page,
    )
    total_row = await conn.fetchrow(count_sql, query.tenant_id, query.recipient_iri)
    records = [
        NotificationRecord(
            id=str(row["id"]),
            event_type=row["event_type"],
            payload=_load_payload(row["payload"]),
            delivered_channels=list(row["delivered_channels"]),
            read=row["read"],
            created_at=row["created_at"],
        )
        for row in rows
    ]
    total = int(total_row["total"]) if total_row is not None else 0
    return records, total


async def mark_read(
    conn: asyncpg.Connection, *, tenant_id: str, recipient_iri: str, notif_id: str
) -> bool:
    """AC-6: idempotent -- a second call on an already-read row is still a
    no-op UPDATE, not an error; both calls return True as long as the row
    exists and belongs to this recipient.
    """
    row = await conn.fetchrow(
        "SELECT id FROM notifications WHERE id = $1 AND tenant_id = $2 AND recipient_iri = $3",
        notif_id,
        tenant_id,
        recipient_iri,
    )
    if row is None:
        return False
    await conn.execute(
        "UPDATE notifications SET read = true"
        " WHERE id = $1 AND tenant_id = $2 AND recipient_iri = $3",
        notif_id,
        tenant_id,
        recipient_iri,
    )
    return True


async def get_user_prefs(
    conn: asyncpg.Connection, *, tenant_id: str, recipient_iri: str, event_type: str
) -> list[str]:
    """No stored preference defaults to `in_app` only -- never Slack until the
    recipient opts in.
    """
    row = await conn.fetchrow(
        "SELECT channels FROM notification_preferences"
        " WHERE tenant_id = $1 AND recipient_iri = $2 AND event_type = $3",
        tenant_id,
        recipient_iri,
        event_type,
    )
    return list(row["channels"]) if row is not None else ["in_app"]


async def upsert_pref(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    recipient_iri: str,
    event_type: str,
    channels: list[str],
) -> None:
    """AC-5: `event_type` is accepted verbatim -- never checked against a
    fixed enum, here or anywhere else on this write path.
    """
    if "in_app" not in channels:
        raise BadRequest("in_app_channel_mandatory")
    await conn.execute(
        """
        INSERT INTO notification_preferences (tenant_id, recipient_iri, event_type, channels)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (tenant_id, recipient_iri, event_type)
        DO UPDATE SET channels = EXCLUDED.channels, updated_at = now()
        """,
        tenant_id,
        recipient_iri,
        event_type,
        channels,
    )


async def increment_connector_error(
    conn: asyncpg.Connection, *, tenant_id: str, connector: str
) -> None:
    await conn.execute(
        """
        INSERT INTO connector_health (tenant_id, connector, error_count, last_error_at)
        VALUES ($1, $2, 1, now())
        ON CONFLICT (tenant_id, connector)
        DO UPDATE SET error_count = connector_health.error_count + 1, last_error_at = now()
        """,
        tenant_id,
        connector,
    )


async def get_connector_error_count(
    conn: asyncpg.Connection, *, tenant_id: str, connector: str
) -> int:
    row = await conn.fetchrow(
        "SELECT error_count FROM connector_health WHERE tenant_id = $1 AND connector = $2",
        tenant_id,
        connector,
    )
    return int(row["error_count"]) if row is not None else 0
