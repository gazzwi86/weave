"""AC-5/AC-6: preferences upsert (open taxonomy, in_app mandatory) and
idempotent mark-read, against a stub asyncpg connection (no real Postgres --
mirrors test_settings_resolver.py's `_FakeConnection` pattern).
"""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.notifications import store

_TENANT = "acme-corp"
_RECIPIENT = "urn:weave:principal:user:u-1"


class _FakeConnection:
    """In-memory stand-in keyed by (tenant_id, recipient_iri, event_type) for
    preferences, and by notif_id for a single notification row.
    """

    def __init__(self, notification: dict[str, Any] | None = None) -> None:
        self.prefs: dict[tuple[str, str, str], list[str]] = {}
        self.notification = notification

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        if "FROM notification_preferences" in query:
            tenant_id, recipient_iri, event_type = args
            channels = self.prefs.get((tenant_id, recipient_iri, event_type))
            return {"channels": channels} if channels is not None else None
        if "SELECT id FROM notifications" in query:
            notif_id, tenant_id, recipient_iri = args
            if (
                self.notification is not None
                and self.notification["id"] == notif_id
                and self.notification["tenant_id"] == tenant_id
                and self.notification["recipient_iri"] == recipient_iri
            ):
                return {"id": notif_id}
            return None
        raise AssertionError(f"unexpected query: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        if "INSERT INTO notification_preferences" in query:
            tenant_id, recipient_iri, event_type, channels = args
            self.prefs[(tenant_id, recipient_iri, event_type)] = list(channels)
            return "INSERT 0 1"
        if "UPDATE notifications SET read = true" in query:
            notif_id, _tenant_id, _recipient_iri = args
            assert self.notification is not None
            assert self.notification["id"] == notif_id
            self.notification["read"] = True
            return "UPDATE 1"
        raise AssertionError(f"unexpected query: {query}")


async def test_notification_prefs_open_taxonomy() -> None:
    """AC-5: any `event_type` string is accepted -- never validated against
    a fixed enum.
    """
    conn = _FakeConnection()

    await store.upsert_pref(
        conn,
        tenant_id=_TENANT,
        recipient_iri=_RECIPIENT,
        event_type="my.custom.event",
        channels=["in_app"],
    )

    assert conn.prefs[(_TENANT, _RECIPIENT, "my.custom.event")] == ["in_app"]


async def test_notification_prefs_in_app_mandatory() -> None:
    conn = _FakeConnection()

    with pytest.raises(store.BadRequest) as exc_info:
        await store.upsert_pref(
            conn,
            tenant_id=_TENANT,
            recipient_iri=_RECIPIENT,
            event_type="job.failed",
            channels=["slack"],
        )

    assert exc_info.value.error == "in_app_channel_mandatory"
    assert (_TENANT, _RECIPIENT, "job.failed") not in conn.prefs


async def test_notification_mark_read_idempotent() -> None:
    conn = _FakeConnection(
        notification={"id": "n-1", "tenant_id": _TENANT, "recipient_iri": _RECIPIENT, "read": False}
    )

    first = await store.mark_read(
        conn, tenant_id=_TENANT, recipient_iri=_RECIPIENT, notif_id="n-1"
    )
    second = await store.mark_read(
        conn, tenant_id=_TENANT, recipient_iri=_RECIPIENT, notif_id="n-1"
    )

    assert first is True
    assert second is True
    assert conn.notification is not None
    assert conn.notification["read"] is True


async def test_notification_mark_read_missing_row_returns_false() -> None:
    conn = _FakeConnection(notification=None)

    found = await store.mark_read(
        conn, tenant_id=_TENANT, recipient_iri=_RECIPIENT, notif_id="does-not-exist"
    )

    assert found is False
