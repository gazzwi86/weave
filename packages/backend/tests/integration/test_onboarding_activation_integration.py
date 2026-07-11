"""ONB-TASK-011 integration tests (real Postgres + Oxigraph, ADR-003/ADR-004):
the release-gate exactly-once race, own-workspace-vs-sandbox scoping, and
notify-outage retry. Marked `integration`/`docker` per
`test_onboarding_state_api.py`'s precedent -- CI's default `api` job runs no
compose services.
"""

from __future__ import annotations

import asyncio
import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.notifications.store import NotificationEvent
from weave_backend.onboarding.outbox_dispatcher import flush_pending
from weave_backend.onboarding.poller import poll_user, select_pollable_users
from weave_backend.onboarding.recorder import MilestoneSource, record_milestone
from weave_backend.operations.versioning import publish_version
from weave_backend.rdf.oxigraph_client import clear_graph
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.sessions import set_active_workspace
from weave_backend.tenancy.workspaces import Workspace, create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_MILESTONE = "first_committed_entity"


def _unique_tenant(label: str) -> str:
    return f"tenant-{label}-{uuid.uuid4().hex[:8]}"


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


async def _make_workspace(tenant_id: str, *, label: str) -> Workspace:
    async with tenant_connection(tenant_id) as conn:
        return await create_workspace(conn, tenant_id=tenant_id, slug=label, display_name=label)


async def _add_member(tenant_id: str, workspace_id: str, *, user_sub: str) -> None:
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            email=f"{user_sub}@example.invalid",
            role="admin",
        )
        await activate_member(
            conn, workspace_id=workspace_id, email=f"{user_sub}@example.invalid", user_sub=user_sub
        )


async def _commit_entity(
    client: AsyncClient, *, tenant_id: str, user_sub: str, workspace_id: str
) -> None:
    """Commits one real BPMO node via the actual apply pipeline, switching
    the caller's active workspace to `workspace_id` first -- the same shape
    `has_committed_entity`'s PROV ASK checks for in production. `apply` only
    mints a draft version (`resolve_version("latest")` needs published), so
    this also publishes it -- matching what a real user's "commit" flow does
    end to end.
    """
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch = await client.post(f"/api/workspaces/{workspace_id}/switch", headers=headers)
    assert switch.status_code == 200
    apply = await client.post(
        "/api/operations/apply",
        json={
            "operations": [
                {"op": "add_node", "ref": "a1", "kind": "Actor", "label": "Billing Team"}
            ],
            # `has_committed_entity`'s PROV ASK checks attribution to this
            # specific user -- must match `human_principal_iri(user_sub)`,
            # not an arbitrary actor IRI.
            "actor": human_principal_iri(user_sub),
        },
        headers=headers,
    )
    assert apply.status_code == 201
    version_iri = apply.json()["version_iri"]
    async with tenant_connection(tenant_id) as conn:
        await publish_version(
            conn, tenant_id=tenant_id, workspace_id=workspace_id, version_iri=version_iri
        )


async def _seed_onboarding_row(tenant_id: str, user_id: str) -> None:
    async with tenant_connection(tenant_id) as conn:
        await conn.execute(
            "INSERT INTO onboarding_state (tenant_id, user_id, role_path, sandbox_forked_at) "
            "VALUES ($1, $2, 'business', now())",
            tenant_id,
            user_id,
        )


async def test_activation_exactly_once_under_concurrent_writers(platform_stack: Path) -> None:
    """AC-011-02/03 release gate: two concurrent record_milestone calls for
    the same (tenant, user, milestone) -- e.g. the poller and a self-mark
    racing -- must produce exactly one activation row and exactly one
    outbox row, never two.
    """
    tenant_id = _unique_tenant("onb-race")
    user_id = human_principal_iri("u-race")

    async def _attempt(source: MilestoneSource) -> bool:
        async with tenant_connection(tenant_id) as conn:
            return await record_milestone(
                conn, tenant_id=tenant_id, user_id=user_id, milestone_id=_MILESTONE, source=source
            )

    results = await asyncio.gather(_attempt("poll"), _attempt("manual"))
    assert sorted(results) == [False, True]

    async with tenant_connection(tenant_id) as conn:
        activation_rows = await conn.fetch(
            "SELECT milestone_id FROM activation WHERE tenant_id = $1 AND user_id = $2",
            tenant_id,
            user_id,
        )
        outbox_rows = await conn.fetch(
            "SELECT id FROM outbox WHERE tenant_id = $1 AND user_id = $2", tenant_id, user_id
        )
    assert len(activation_rows) == 1
    assert len(outbox_rows) == 1


async def test_own_workspace_commit_fires_sandbox_commit_does_not(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-011-01/07: a PROV-attributed commit in the user's own (active)
    workspace fires the milestone; an identical commit in a *different*
    workspace the poller never treats as active does not.
    """
    tenant_id = _unique_tenant("onb-ownws")
    user_sub = "u-ownws"
    user_id = human_principal_iri(user_sub)
    own_ws = await _make_workspace(tenant_id, label="own")
    sandbox_ws = await _make_workspace(tenant_id, label="sandbox")
    await _add_member(tenant_id, own_ws.id, user_sub=user_sub)
    await _add_member(tenant_id, sandbox_ws.id, user_sub=user_sub)
    await _seed_onboarding_row(tenant_id, user_id)

    try:
        # Commit into the sandbox workspace, then leave it active workspace
        # switches to sandbox as a side effect of _commit_entity, so switch
        # back to "own" before polling -- the poller only ever reads the
        # session's *current* active workspace.
        await _commit_entity(
            client, tenant_id=tenant_id, user_sub=user_sub, workspace_id=sandbox_ws.id
        )
        await set_active_workspace(tenant_id, user_sub, own_ws.id)

        async with tenant_connection(tenant_id) as conn:
            users = await select_pollable_users(conn, tenant_id)
            assert len(users) == 1
            await poll_user(conn, users[0])
            not_fired = await conn.fetch(
                "SELECT 1 FROM activation WHERE tenant_id = $1 AND user_id = $2", tenant_id, user_id
            )
        assert not_fired == []  # sandbox commit must not have fired it

        # Now commit into the user's real own workspace and re-poll.
        await _commit_entity(client, tenant_id=tenant_id, user_sub=user_sub, workspace_id=own_ws.id)

        async with tenant_connection(tenant_id) as conn:
            users = await select_pollable_users(conn, tenant_id)
            assert len(users) == 1
            await poll_user(conn, users[0])
            fired = await conn.fetch(
                "SELECT 1 FROM activation WHERE tenant_id = $1 AND user_id = $2", tenant_id, user_id
            )
        assert len(fired) == 1
    finally:
        await clear_graph(own_ws.named_graph_iri)
        await clear_graph(sandbox_ws.named_graph_iri)


async def test_notify_outage_retries_then_dispatches_once_on_recovery(platform_stack: Path) -> None:
    """AC-011-04: PLAT-NOTIFY-1 unavailable -> the outbox row stays pending
    and its attempt_count bumps; on recovery it dispatches exactly once,
    never a second time on a later flush -- proven against real Postgres
    row-claim (FOR UPDATE SKIP LOCKED), not the unit test's FakeConn.
    """
    tenant_id = _unique_tenant("onb-notify")
    user_id = human_principal_iri("u-notify")

    async with tenant_connection(tenant_id) as conn:
        won = await record_milestone(
            conn, tenant_id=tenant_id, user_id=user_id, milestone_id=_MILESTONE, source="poll"
        )
    assert won is True

    async def _failing_notifier(conn: object, event: NotificationEvent) -> None:
        raise ConnectionError("PLAT-NOTIFY-1 unavailable")

    async with tenant_connection(tenant_id) as conn:
        dispatched = await flush_pending(conn, notifier=_failing_notifier)
    assert dispatched == 0

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT dispatched_at, attempt_count FROM outbox WHERE tenant_id = $1 AND user_id = $2",
            tenant_id,
            user_id,
        )
    assert row["dispatched_at"] is None
    assert row["attempt_count"] == 1

    recovered_calls: list[NotificationEvent] = []

    async def _recovered_notifier(conn: object, event: NotificationEvent) -> None:
        recovered_calls.append(event)

    async with tenant_connection(tenant_id) as conn:
        dispatched = await flush_pending(conn, notifier=_recovered_notifier)
    assert dispatched == 1
    assert len(recovered_calls) == 1

    # A later flush must not re-dispatch an already-dispatched row.
    async with tenant_connection(tenant_id) as conn:
        dispatched_again = await flush_pending(conn, notifier=_recovered_notifier)
    assert dispatched_again == 0
    assert len(recovered_calls) == 1
