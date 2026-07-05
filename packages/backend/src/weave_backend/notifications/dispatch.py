"""PLAT-NOTIFY-1 dispatch pipeline (`dispatch_notification`) -- the one entry
point any engine (billing, audit, build, ...) calls to raise a notification.
In-app delivery is persisted before any Slack attempt on every code path
(AC-1); a Slack attempt only ever runs afterwards, and its outcome can never
undo the in-app write.

Callers pass their own already-open `conn` (same `tenant_connection` block as
their own business-logic write), matching how `audit.emitter` is already
threaded through `routers/settings.py` -- one atomic transaction per request,
not a second pool checkout.
"""

from __future__ import annotations

import asyncio
import logging
import uuid

import asyncpg

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.notifications import store
from weave_backend.notifications.slack_connector import (
    SlackChannelUnavailable,
    SlackConnector,
    default_slack_connector,
    format_slack_message,
)
from weave_backend.notifications.store import NotificationEvent

log = logging.getLogger(__name__)

MAX_SLACK_ATTEMPTS = 3
_BACKOFF_CAP_SECONDS = 10
_SECURITY_EVENT_PREFIX = "security."


def _is_security_event(event_type: str) -> bool:
    return event_type.startswith(_SECURITY_EVENT_PREFIX)


async def dispatch_notification(
    conn: asyncpg.Connection,
    event: NotificationEvent,
    *,
    connector: SlackConnector = default_slack_connector,
) -> uuid.UUID:
    """AC-1/AC-7: persists in-app unconditionally, then attempts Slack when
    the recipient has opted in *or* the event is a `security.*` event --
    that override can never be turned off by preference (AC-7).
    """
    notif_id = uuid.uuid4()
    await store.insert_notification(
        conn, notif_id=notif_id, event=event, delivered_channels=["in_app"]
    )
    await default_audit_emitter.emit(
        conn,
        AuditEvent(
            tenant_id=event.tenant_id,
            event_type="notification.dispatched",
            actor_iri=event.actor_iri,
            subject_iri=f"urn:weave:notification:{notif_id}",
            payload={"event_type": event.event_type},
        ),
    )

    prefs = await store.get_user_prefs(
        conn,
        tenant_id=event.tenant_id,
        recipient_iri=event.recipient_iri,
        event_type=event.event_type,
    )
    is_security = _is_security_event(event.event_type)
    if is_security or "slack" in prefs:
        await deliver_slack_with_retry(conn, event, notif_id, connector)
    return notif_id


async def deliver_slack_with_retry(
    conn: asyncpg.Connection,
    event: NotificationEvent,
    notif_id: uuid.UUID,
    connector: SlackConnector,
    max_attempts: int = MAX_SLACK_ATTEMPTS,
) -> None:
    """AC-3/AC-4: in-app is already persisted regardless of outcome here.
    `SlackChannelUnavailable` (the M1 stub's permanent state) is not a
    delivery failure -- logged once, no retry, no connector_health hit.
    Anything else a connector raises (`SlackDeliveryError` or an unexpected
    type -- the `SlackConnector` Protocol can't constrain what a real
    implementation throws) is treated as a failed attempt: capped exponential
    backoff, connector_health bump, graceful give-up after `max_attempts`.
    No exception escapes -- an escape would unwind the caller's shared
    transaction and roll back the in-app row AC-1 just guaranteed.
    """
    text = format_slack_message(event.payload)
    for attempt in range(max_attempts):
        try:
            await connector.post_message(
                tenant_id=event.tenant_id, recipient_iri=event.recipient_iri, text=text
            )
        except SlackChannelUnavailable:
            log.info("slack_channel_unavailable", extra={"notif_id": str(notif_id)})
            return
        except Exception as exc:  # deliberately broad -- see docstring: nothing may escape
            await store.increment_connector_error(
                conn, tenant_id=event.tenant_id, connector="slack"
            )
            if attempt == max_attempts - 1:
                log.warning(
                    "slack_delivery_failed", extra={"notif_id": str(notif_id), "error": str(exc)}
                )
                return
            await asyncio.sleep(min(2**attempt, _BACKOFF_CAP_SECONDS))
        else:
            await store.append_delivered_channel(conn, notif_id=notif_id, channel="slack")
            return
