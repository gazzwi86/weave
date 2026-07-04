"""AC-1/AC-7: dispatch ordering (in-app persisted before any Slack attempt)
and the security-event override, against mocked `store`/audit-emitter calls
-- no real Postgres (see tests/integration/test_notifications_api.py for the
real-DB Slack-retry/tenant-scoping proofs).
"""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock, patch

from weave_backend.notifications.dispatch import deliver_slack_with_retry, dispatch_notification
from weave_backend.notifications.slack_connector import SlackChannelUnavailable, SlackDeliveryError
from weave_backend.notifications.store import NotificationEvent

_TENANT = "acme-corp"
_RECIPIENT = "urn:weave:principal:user:u-1"
_ACTOR = "urn:weave:principal:agent:job-runner"
_NOTIF_ID = uuid.uuid4()


def _event(event_type: str, payload: dict[str, Any] | None = None) -> NotificationEvent:
    return NotificationEvent(
        tenant_id=_TENANT,
        recipient_iri=_RECIPIENT,
        event_type=event_type,
        payload=payload or {},
        actor_iri=_ACTOR,
    )


class _RecordingConnector:
    """Fake `SlackConnector` -- records whether/when it was called without
    talking to anything real (Law F).
    """

    def __init__(self, call_order: list[str]) -> None:
        self._call_order = call_order

    async def post_message(self, *, tenant_id: str, recipient_iri: str, text: str) -> None:
        self._call_order.append("slack")


def _patched_store(prefs: list[str], call_order: list[str]) -> tuple[Any, ...]:
    async def fake_insert(_conn: Any, **_kwargs: Any) -> None:
        call_order.append("insert")

    return (
        patch(
            "weave_backend.notifications.dispatch.store.insert_notification",
            AsyncMock(side_effect=fake_insert),
        ),
        patch(
            "weave_backend.notifications.dispatch.store.get_user_prefs",
            AsyncMock(return_value=prefs),
        ),
        patch("weave_backend.notifications.dispatch.default_audit_emitter.emit", AsyncMock()),
    )


async def test_notification_persisted_on_event() -> None:
    """AC-1: `insert_notification` is called with `delivered_channels =
    ["in_app"]`, and always before any Slack attempt when the recipient has
    opted in.
    """
    call_order: list[str] = []
    insert_mock = AsyncMock(side_effect=lambda _conn, **_kw: call_order.append("insert"))
    connector = _RecordingConnector(call_order)

    with (
        patch("weave_backend.notifications.dispatch.store.insert_notification", insert_mock),
        patch(
            "weave_backend.notifications.dispatch.store.get_user_prefs",
            AsyncMock(return_value=["in_app", "slack"]),
        ),
        patch("weave_backend.notifications.dispatch.default_audit_emitter.emit", AsyncMock()),
    ):
        await dispatch_notification(
            AsyncMock(),
            _event("job.completed", {"job_id": "j-1"}),
            connector=connector,
        )

    insert_mock.assert_awaited_once()
    assert insert_mock.call_args.kwargs["delivered_channels"] == ["in_app"]
    assert call_order == ["insert", "slack"]


async def test_security_events_always_delivered() -> None:
    """AC-7: `security.*` always attempts Slack, even when the recipient's
    stored preference is `in_app` only.
    """
    call_order: list[str] = []
    connector = _RecordingConnector(call_order)
    patches = _patched_store(prefs=["in_app"], call_order=call_order)

    with patches[0], patches[1], patches[2]:
        await dispatch_notification(
            AsyncMock(),
            _event("security.permission.escalation", {"message": "role elevated"}),
            connector=connector,
        )

    assert call_order == ["insert", "slack"]


async def test_non_security_event_without_slack_preference_never_attempts_slack() -> None:
    call_order: list[str] = []

    class _FailIfCalledConnector:
        async def post_message(self, **_kwargs: Any) -> None:
            raise AssertionError("Slack should never be attempted for this preference")

    patches = _patched_store(prefs=["in_app"], call_order=call_order)
    with patches[0], patches[1], patches[2]:
        await dispatch_notification(
            AsyncMock(),
            _event("job.completed"),
            connector=_FailIfCalledConnector(),
        )

    assert call_order == ["insert"]


async def test_slack_channel_unavailable_is_logged_not_raised() -> None:
    """M1 scope note: the default stub connector's `SlackChannelUnavailable`
    never surfaces as an error out of `dispatch_notification`.
    """

    class _UnavailableConnector:
        async def post_message(self, **_kwargs: Any) -> None:
            raise SlackChannelUnavailable("acme-corp")

    call_order: list[str] = []
    patches = _patched_store(prefs=["in_app", "slack"], call_order=call_order)
    with patches[0], patches[1], patches[2]:
        await dispatch_notification(
            AsyncMock(),
            _event("job.completed"),
            connector=_UnavailableConnector(),
        )

    assert call_order == ["insert"]


async def test_deliver_slack_with_retry_gives_up_after_max_attempts_no_exception() -> None:
    """AC-4's retry/backoff shape, isolated from `dispatch_notification`:
    exactly `max_attempts` tries, one connector_health bump per failed
    attempt, no exception escapes (in-app already succeeded before this is
    ever called). `asyncio.sleep` is patched so the test doesn't actually
    wait through the backoff.
    """
    connector = AsyncMock()
    connector.post_message = AsyncMock(side_effect=SlackDeliveryError("timeout"))
    increment_mock = AsyncMock()

    with (
        patch(
            "weave_backend.notifications.dispatch.store.increment_connector_error",
            increment_mock,
        ),
        patch("weave_backend.notifications.dispatch.asyncio.sleep", AsyncMock()),
    ):
        await deliver_slack_with_retry(
            AsyncMock(), _event("job.failed"), _NOTIF_ID, connector
        )

    assert connector.post_message.await_count == 3
    assert increment_mock.await_count == 3


async def test_deliver_slack_with_retry_succeeds_after_a_transient_failure() -> None:
    connector = AsyncMock()
    connector.post_message = AsyncMock(side_effect=[SlackDeliveryError("timeout"), None])
    append_mock = AsyncMock()

    with (
        patch("weave_backend.notifications.dispatch.store.increment_connector_error", AsyncMock()),
        patch("weave_backend.notifications.dispatch.store.append_delivered_channel", append_mock),
        patch("weave_backend.notifications.dispatch.asyncio.sleep", AsyncMock()),
    ):
        await deliver_slack_with_retry(
            AsyncMock(), _event("job.failed"), _NOTIF_ID, connector
        )

    assert connector.post_message.await_count == 2
    append_mock.assert_awaited_once()
