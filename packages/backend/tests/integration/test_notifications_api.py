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


# QA edge cases: the two routes below (`mark_read_route`,
# `update_preferences_route`) had unit coverage against a fake connection
# (test_notifications_store.py) but were never exercised through the real
# FastAPI router + Postgres/RLS -- 50% router coverage in the fast lane.
# These close that gap and add a security-relevant probe (mark-read must not
# leak/mutate another recipient's notification) no existing test covered.


async def test_mark_read_route_is_idempotent_via_http(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-6 through the real router: both calls return 200, and the item
    drops out of the unread listing after the first call.
    """
    tenant_id = _unique_tenant("notify-read")
    user_sub = "u-notify-read"
    recipient_iri = human_principal_iri(user_sub)

    async with tenant_connection(tenant_id) as conn:
        notif_id = await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=tenant_id,
                recipient_iri=recipient_iri,
                event_type="job.completed",
                payload={"job_id": "j-5"},
                actor_iri="urn:weave:principal:agent:job-runner",
            ),
        )

    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    first = await client.post(f"/api/notifications/{notif_id}/read", headers=headers)
    second = await client.post(f"/api/notifications/{notif_id}/read", headers=headers)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == {"id": str(notif_id), "read": True}
    assert second.json() == {"id": str(notif_id), "read": True}

    listing = await client.get(
        "/api/notifications", params={"unread": "true"}, headers=headers
    )
    assert listing.json()["total"] == 0


async def test_mark_read_route_rejects_another_recipients_notification(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Security edge case: recipient B (same tenant) must not be able to mark
    recipient A's notification as read -- 404, and A's copy stays unread.
    """
    tenant_id = _unique_tenant("notify-cross-recipient")
    recipient_a = human_principal_iri("u-notify-owner")

    async with tenant_connection(tenant_id) as conn:
        notif_id = await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=tenant_id,
                recipient_iri=recipient_a,
                event_type="job.completed",
                payload={"job_id": "j-6"},
                actor_iri="urn:weave:principal:agent:job-runner",
            ),
        )

    tokens_b = await issue_token_pair(sub="u-notify-other", tenant_id=tenant_id)
    response = await client.post(
        f"/api/notifications/{notif_id}/read",
        headers={"Authorization": f"Bearer {tokens_b.access_token}"},
    )
    assert response.status_code == 404

    tokens_a = await issue_token_pair(sub="u-notify-owner", tenant_id=tenant_id)
    listing = await client.get(
        "/api/notifications",
        params={"unread": "true"},
        headers={"Authorization": f"Bearer {tokens_a.access_token}"},
    )
    assert listing.json()["total"] == 1


async def test_preferences_update_route_rejects_missing_in_app(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-5 through the real router: an `in_app`-less channel list is a 400,
    not a silently-accepted preference.
    """
    tenant_id = _unique_tenant("notify-prefs-reject")
    tokens = await issue_token_pair(sub="u-notify-prefs", tenant_id=tenant_id)

    response = await client.put(
        "/api/notifications/preferences",
        json={"event_type": "job.failed", "channels": ["slack"]},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == {"error": "in_app_channel_mandatory"}


async def test_preferences_update_route_open_taxonomy_enables_slack_via_dispatch(
    client: AsyncClient, platform_stack: Path
) -> None:
    """End-to-end contract: a preference saved through the real HTTP route
    (custom, non-fixed `event_type`) is what `dispatch_notification` reads
    back to decide Slack delivery -- proves the route and the dispatch
    pipeline agree on the same preference row, not just the store function
    in isolation.
    """
    tenant_id = _unique_tenant("notify-prefs-e2e")
    user_sub = "u-notify-prefs-e2e"
    recipient_iri = human_principal_iri(user_sub)
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)

    saved = await client.put(
        "/api/notifications/preferences",
        json={"event_type": "billing.invoice.overdue", "channels": ["in_app", "slack"]},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert saved.status_code == 200
    assert saved.json() == {"saved": True}

    connector = _SucceedingConnector()
    async with tenant_connection(tenant_id) as conn:
        await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=tenant_id,
                recipient_iri=recipient_iri,
                event_type="billing.invoice.overdue",
                payload={"invoice_id": "inv-1"},
                actor_iri="urn:weave:principal:agent:billing-engine",
            ),
            connector=connector,
        )

    assert len(connector.calls) == 1


async def test_get_preferences_returns_all_eight_types_with_current_state(
    client: AsyncClient, platform_stack: Path
) -> None:
    """TASK-030 AC-4/AC-6: `GET /api/notifications/preferences` returns all 8
    types grouped by category, defaults unset types from the caller's
    workspace role, and an explicit stored preference overrides the default.
    """
    from weave_backend.tenancy.members import activate_member, invite_member
    from weave_backend.tenancy.sessions import set_active_workspace
    from weave_backend.tenancy.workspaces import create_workspace

    tenant_id = _unique_tenant("notify-prefs")
    user_sub = "u-notify-admin"
    recipient_iri = human_principal_iri(user_sub)

    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Prefs workspace"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="admin@acme-corp.example",
            role="workspace_admin",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email="admin@acme-corp.example", user_sub=user_sub
        )
        # AC-6/role-derived default: workspace_admin defaults billing.cap.warning
        # ON without ever setting it explicitly.
        await upsert_pref(
            conn,
            tenant_id=tenant_id,
            recipient_iri=recipient_iri,
            event_type="model.change.mention",
            channels=["in_app"],
        )
    await set_active_workspace(tenant_id, user_sub, workspace.id)

    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    response = await client.get(
        "/api/notifications/preferences",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 200
    body = response.json()
    types = {t["event_type"]: t for t in body["types"]}
    assert set(types) == {
        "model.version.published",
        "model.change.mention",
        "model.conformance.regression",
        "build.request.completed",
        "build.request.failed",
        "audit.chain.invalid",
        "billing.cap.warning",
        "member.added",
    }
    assert types["model.version.published"]["group"] == "Model"
    assert types["audit.chain.invalid"]["group"] == "Governance"
    # Explicitly stored -- overrides the role default.
    assert types["model.change.mention"]["in_app_enabled"] is True
    # Role-derived default (workspace_admin), never explicitly set.
    assert types["billing.cap.warning"]["in_app_enabled"] is True
    # Not in workspace_admin's default set and never explicitly set.
    assert types["model.conformance.regression"]["in_app_enabled"] is False
    for t in body["types"]:
        assert t["email_enabled"] is False
        assert t["email_locked_post_v1"] is True
