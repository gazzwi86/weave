"""PLAT-TASK-007 integration tests: tenant-scoped notification centre (AC-2)
and the Slack delivery/failure legs (AC-3/AC-4) against a stubbed connector
double (M1 scope note -- no real Slack SDK/client, Law F).

Marked both `integration` and `docker` per `test_search_tenancy.py`'s
precedent: CI's default `api` job runs with no compose services up.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.notifications.dispatch import dispatch_notification
from weave_backend.notifications.slack_connector import SlackDeliveryError
from weave_backend.notifications.store import (
    NotificationEvent,
    get_connector_error_count,
    upsert_pref,
)

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_notifications_tenant_scoped(client: AsyncClient, platform_stack: Path) -> None:
    """AC-2: a notification dispatched to tenant A's recipient must never
    appear in tenant B's notification centre, even for the identical `sub`.
    """
    tenant_a = _unique_tenant("notify-a")
    tenant_b = _unique_tenant("notify-b")
    user_sub = "u-notify-shared"
    recipient_a = human_principal_iri(user_sub)

    async with tenant_connection(tenant_a) as conn:
        await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=tenant_a,
                recipient_iri=recipient_a,
                event_type="job.completed",
                payload={"job_id": "j-1", "result": "success"},
                actor_iri="urn:weave:principal:agent:job-runner",
            ),
        )

    tokens_b = await issue_token_pair(sub=user_sub, tenant_id=tenant_b)
    response = await client.get(
        "/api/notifications",
        params={"unread": "true"},
        headers={"Authorization": f"Bearer {tokens_b.access_token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"notifications": [], "total": 0, "page": 1, "per_page": 25}


async def test_notification_appears_for_its_own_tenant(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("notify-own")
    user_sub = "u-notify-own"
    recipient_iri = human_principal_iri(user_sub)

    async with tenant_connection(tenant_id) as conn:
        await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=tenant_id,
                recipient_iri=recipient_iri,
                event_type="job.completed",
                payload={"job_id": "j-2", "result": "success"},
                actor_iri="urn:weave:principal:agent:job-runner",
            ),
        )

    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    response = await client.get(
        "/api/notifications",
        params={"unread": "true"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["notifications"][0]["event_type"] == "job.completed"
    assert body["notifications"][0]["delivered_channels"] == ["in_app"]
    assert body["notifications"][0]["read"] is False


class _SucceedingConnector:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def post_message(self, *, tenant_id: str, recipient_iri: str, text: str) -> None:
        self.calls.append({"tenant_id": tenant_id, "recipient_iri": recipient_iri, "text": text})


async def test_slack_delivery_on_preference_enabled(platform_stack: Path) -> None:
    """AC-3: a Slack-enabled preference attempts delivery via the injected
    connector double; success appends `"slack"` to `delivered_channels`.
    """
    tenant_id = _unique_tenant("notify-slack-ok")
    recipient_iri = human_principal_iri("u-notify-slack-ok")
    connector = _SucceedingConnector()

    async with tenant_connection(tenant_id) as conn:
        await upsert_pref(
            conn,
            tenant_id=tenant_id,
            recipient_iri=recipient_iri,
            event_type="job.failed",
            channels=["in_app", "slack"],
        )
        notif_id = await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=tenant_id,
                recipient_iri=recipient_iri,
                event_type="job.failed",
                payload={"job_id": "j-3"},
                actor_iri="urn:weave:principal:agent:job-runner",
            ),
            connector=connector,
        )
        row = await conn.fetchrow(
            "SELECT delivered_channels FROM notifications WHERE id = $1", notif_id
        )

    assert len(connector.calls) == 1
    assert connector.calls[0]["recipient_iri"] == recipient_iri
    assert row is not None
    assert set(row["delivered_channels"]) == {"in_app", "slack"}


async def test_slack_failure_delivers_inapp(platform_stack: Path) -> None:
    """AC-4: a connector that always fails still leaves in-app delivered,
    increments connector_health's error_count, and never retries beyond 3
    attempts.
    """
    tenant_id = _unique_tenant("notify-slack-fail")
    recipient_iri = human_principal_iri("u-notify-slack-fail")
    connector = AsyncMock()
    connector.post_message = AsyncMock(side_effect=SlackDeliveryError("timeout"))

    async with tenant_connection(tenant_id) as conn:
        await upsert_pref(
            conn,
            tenant_id=tenant_id,
            recipient_iri=recipient_iri,
            event_type="job.failed",
            channels=["in_app", "slack"],
        )
        notif_id = await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=tenant_id,
                recipient_iri=recipient_iri,
                event_type="job.failed",
                payload={"job_id": "j-4"},
                actor_iri="urn:weave:principal:agent:job-runner",
            ),
            connector=connector,
        )
        row = await conn.fetchrow(
            "SELECT delivered_channels FROM notifications WHERE id = $1", notif_id
        )
        error_count = await get_connector_error_count(conn, tenant_id=tenant_id, connector="slack")

    assert row is not None
    assert row["delivered_channels"] == ["in_app"]
    assert connector.post_message.await_count == 3
    assert error_count == 3
