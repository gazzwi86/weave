"""ONB-TASK-001 integration tests: the six onboarding tables' fail-closed RLS
(AC-001-01/02), two-user-same-tenant scoping (AC-001-03), the bootstrap read
(AC-001-04), HTTP-level persistence of every route (AC-001-05), and the
`activation` primary key's exactly-once guarantee (AC-001-06).

Marked both `integration` and `docker` per `test_v1_pm_tables.py`'s
precedent: CI's default `api` job runs with no compose services up.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.migrate import _dsn
from weave_backend.db.pool import tenant_connection, untenanted_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_ONBOARDING_TABLES = (
    "onboarding_state",
    "tour_progress",
    "dismissal",
    "exercise_completion",
    "activation",
    "outbox",
)


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


async def test_all_six_onboarding_tables_have_row_level_security_enabled_and_forced(
    platform_stack: Path,
) -> None:
    async with untenanted_connection() as conn:
        rows = await conn.fetch(
            "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class"
            " WHERE relname = ANY($1::text[])",
            list(_ONBOARDING_TABLES),
        )
    found = {row["relname"]: (row["relrowsecurity"], row["relforcerowsecurity"]) for row in rows}
    assert set(found) == set(_ONBOARDING_TABLES)
    assert all(enabled and forced for enabled, forced in found.values())


@pytest.mark.onboarding_release_gate  # RLS fail-closed
async def test_onboarding_tables_zero_rows_without_session_context(platform_stack: Path) -> None:
    """AC-001-02 fail-closed leg: a connection with no `app.tenant_id` set at
    all (not merely a different tenant) must see zero rows on every table --
    `current_setting(..., true)` returns NULL, the RLS predicate is NULL, and
    Postgres treats NULL as "not true" for every row.

    Uses a raw, ad-hoc `weave_app` connection (`db.migrate._dsn`, same
    pattern as `test_audit_chain_api.py`'s superuser-bypass checks) rather
    than `db.pool.untenanted_connection` -- that helper's own docstring
    reserves it for the one SECURITY DEFINER caller it already has and
    explicitly says "never use this for an ordinary tenancy-table query";
    this test's whole point is an ordinary tenancy-table query with no
    context, so it opens its own connection instead of repurposing that one.
    """
    tenant_id = _unique_tenant("onb-failclosed")
    user_id = human_principal_iri("u-failclosed")

    async with tenant_connection(tenant_id) as conn:
        await conn.execute(
            "INSERT INTO onboarding_state (tenant_id, user_id, role_path, path_variant,"
            " path_chosen_manually) VALUES ($1, $2, 'business', 'default', false)",
            tenant_id,
            user_id,
        )

    conn = await asyncpg.connect(_dsn("weave_app"))
    try:
        for table in _ONBOARDING_TABLES:
            rows = await conn.fetch(f"SELECT 1 FROM {table}")  # noqa: S608 -- fixed table name
            assert rows == [], f"expected zero rows in {table} with no session context"
    finally:
        await conn.close()


async def test_onboarding_tables_zero_rows_with_blank_session_tenant(
    platform_stack: Path,
) -> None:
    """AC-001-02 fail-closed edge case: `app.tenant_id` explicitly set to the
    *empty string* (not merely unset) must also see zero rows. This is a
    different RLS code path than the "no context at all" test above --
    there, ``current_setting(..., true)`` returns NULL and the predicate is
    NULL; here, the predicate becomes a real string comparison
    (``tenant_id = ''``) that must fail to match every row because the
    table's own ``CHECK (tenant_id <> '')`` constraint guarantees no stored
    row ever has an empty ``tenant_id``. Both paths must independently
    fail closed -- a regression that only fixed the NULL case (e.g. a
    predicate rewritten as ``COALESCE(current_setting(...), tenant_id)``)
    would pass the other test while silently leaking rows here.
    """
    tenant_id = _unique_tenant("onb-blank-guc")
    user_id = human_principal_iri("u-blank-guc")

    async with tenant_connection(tenant_id) as conn:
        await conn.execute(
            "INSERT INTO onboarding_state (tenant_id, user_id, role_path, path_variant,"
            " path_chosen_manually) VALUES ($1, $2, 'business', 'default', false)",
            tenant_id,
            user_id,
        )

    conn = await asyncpg.connect(_dsn("weave_app"))
    try:
        await conn.execute("SELECT set_config('app.tenant_id', '', true)")
        for table in _ONBOARDING_TABLES:
            rows = await conn.fetch(f"SELECT 1 FROM {table}")  # noqa: S608 -- fixed table name
            assert rows == [], f"expected zero rows in {table} with blank session tenant"
    finally:
        await conn.close()


async def test_onboarding_tables_cross_tenant_isolation(platform_stack: Path) -> None:
    """AC-001-02 two-tenant leg: tenant B must never see tenant A's rows."""
    tenant_a = _unique_tenant("onb-a")
    tenant_b = _unique_tenant("onb-b")
    user_id = human_principal_iri("u-shared-sub")

    async with tenant_connection(tenant_a) as conn:
        await conn.execute(
            "INSERT INTO onboarding_state (tenant_id, user_id, role_path, path_variant,"
            " path_chosen_manually) VALUES ($1, $2, 'business', 'default', false)",
            tenant_a,
            user_id,
        )

    async with tenant_connection(tenant_b) as conn:
        for table in _ONBOARDING_TABLES:
            rows = await conn.fetch(f"SELECT 1 FROM {table}")  # noqa: S608 -- fixed table name
            assert rows == [], f"tenant B saw rows in {table}"


async def test_two_users_same_tenant_only_ever_see_their_own_state(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-03: no onboarding route accepts a client-supplied user id --
    user scoping is application-layer, derived from the authenticated
    principal only. This is the substance test: two different principals in
    the *same* tenant, each patching/reading only their own row, must never
    see or affect the other's state.
    """
    tenant_id = _unique_tenant("onb-two-users")
    tokens_a = await issue_token_pair(sub="u-onb-a", tenant_id=tenant_id)
    tokens_b = await issue_token_pair(sub="u-onb-b", tenant_id=tenant_id)

    await client.patch(
        "/api/onboarding/state",
        json={"role_path": "technical"},
        headers={"Authorization": f"Bearer {tokens_a.access_token}"},
    )

    state_a = await client.get(
        "/api/onboarding/state", headers={"Authorization": f"Bearer {tokens_a.access_token}"}
    )
    state_b = await client.get(
        "/api/onboarding/state", headers={"Authorization": f"Bearer {tokens_b.access_token}"}
    )

    assert state_a.json()["role_path"] == "technical"
    assert state_b.json()["role_path"] == "business"


async def test_bootstrap_get_state_new_user_returns_defaults_and_persists_nothing(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-04: the SPA's every-screen bootstrap read must never 404 for a
    brand-new user, and (being a GET) must not write a row as a side effect.
    """
    tenant_id = _unique_tenant("onb-new-user")
    user_sub = "u-onb-new"
    user_id = human_principal_iri(user_sub)
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)

    response = await client.get(
        "/api/onboarding/state", headers={"Authorization": f"Bearer {tokens.access_token}"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["role_path"] == "business"
    assert body["path_variant"] == "default"
    assert body["path_chosen_manually"] is False
    assert body["tours"] == []
    assert body["dismissals"] == []
    assert body["exercise_completions"] == []
    assert body["activations"] == []

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT 1 FROM onboarding_state WHERE tenant_id = $1 AND user_id = $2",
            tenant_id,
            user_id,
        )
    assert row is None


async def test_bootstrap_read_aggregates_all_state_kinds(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-04: one GET returns the spine plus tour progress, dismissals,
    exercise completions, and activations in a single response.
    """
    tenant_id = _unique_tenant("onb-bootstrap")
    user_sub = "u-onb-bootstrap"
    user_id = human_principal_iri(user_sub)
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    await client.patch("/api/onboarding/state", json={"role_path": "admin"}, headers=headers)
    await client.put(
        "/api/onboarding/tours/ce-onboarding/progress",
        json={"last_completed_step": 2},
        headers=headers,
    )
    await client.put("/api/onboarding/dismissals/beacon/b-1", headers=headers)

    async with tenant_connection(tenant_id) as conn:
        await conn.execute(
            "INSERT INTO exercise_completion (tenant_id, user_id, exercise_id,"
            " verified_signal, completed_at) VALUES ($1, $2, 'CE-01', 'ask', now())",
            tenant_id,
            user_id,
        )
        await conn.execute(
            "INSERT INTO activation (tenant_id, user_id, milestone_id, source, activated_at)"
            " VALUES ($1, $2, 'first-entity', 'event', now())"
            " ON CONFLICT (tenant_id, user_id, milestone_id) DO NOTHING",
            tenant_id,
            user_id,
        )

    response = await client.get("/api/onboarding/state", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["role_path"] == "admin"
    assert [t["tour_id"] for t in body["tours"]] == ["ce-onboarding"]
    assert [d["ref_id"] for d in body["dismissals"]] == ["b-1"]
    assert [e["exercise_id"] for e in body["exercise_completions"]] == ["CE-01"]
    assert [a["milestone_id"] for a in body["activations"]] == ["first-entity"]


async def test_patch_state_persists_via_http(client: AsyncClient, platform_stack: Path) -> None:
    """AC-001-05: a spine patch is server-side system of record."""
    tenant_id = _unique_tenant("onb-patch")
    tokens = await issue_token_pair(sub="u-onb-patch", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.patch(
        "/api/onboarding/state",
        json={"path_variant": "read_only", "path_chosen_manually": True},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["path_variant"] == "read_only"
    assert body["path_chosen_manually"] is True

    follow_up = await client.get("/api/onboarding/state", headers=headers)
    assert follow_up.json()["path_variant"] == "read_only"


async def test_tour_progress_put_persists_via_http(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("onb-tour")
    tokens = await issue_token_pair(sub="u-onb-tour", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.put(
        "/api/onboarding/tours/ge-onboarding/progress",
        json={"last_completed_step": 4, "completed": True},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == {"saved": True}

    state = await client.get("/api/onboarding/state", headers=headers)
    tour = state.json()["tours"][0]
    assert tour["tour_id"] == "ge-onboarding"
    assert tour["last_completed_step"] == 4
    assert tour["completed_at"] is not None


async def test_dismissal_put_and_delete_via_http(client: AsyncClient, platform_stack: Path) -> None:
    tenant_id = _unique_tenant("onb-dismiss")
    tokens = await issue_token_pair(sub="u-onb-dismiss", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    put_response = await client.put(
        "/api/onboarding/dismissals/welcome_modal/wm-1", headers=headers
    )
    assert put_response.status_code == 200

    state = await client.get("/api/onboarding/state", headers=headers)
    assert [d["ref_id"] for d in state.json()["dismissals"]] == ["wm-1"]

    delete_response = await client.delete(
        "/api/onboarding/dismissals/welcome_modal/wm-1", headers=headers
    )
    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted": True}

    state_after = await client.get("/api/onboarding/state", headers=headers)
    assert state_after.json()["dismissals"] == []


async def test_trust_mechanics_beacon_dismissal_persists_via_http(
    client: AsyncClient, platform_stack: Path
) -> None:
    """ONB-V1-TASK-004 AC-004-03: the versions-panel compare/diff-discoverability
    beacon (`ge-trust-mechanics` in shared/onboarding/content/beacons.ts) persists
    its dismissal server-side per (tenant, user) through the same generic
    dismissal route the M1 beacons use -- no new endpoint, just proof the real
    production beacon id round-trips.
    """
    tenant_id = _unique_tenant("onb-trust-beacon")
    tokens = await issue_token_pair(sub="u-onb-trust-beacon", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    put_response = await client.put(
        "/api/onboarding/dismissals/beacon/ge-trust-mechanics", headers=headers
    )
    assert put_response.status_code == 200

    state = await client.get("/api/onboarding/state", headers=headers)
    assert [d["ref_id"] for d in state.json()["dismissals"]] == ["ge-trust-mechanics"]


async def test_delete_beacon_dismissals_bulk_via_http(
    client: AsyncClient, platform_stack: Path
) -> None:
    """ "Show all hints": bulk-clears every `beacon` dismissal but must never
    touch a `welcome_modal` row.
    """
    tenant_id = _unique_tenant("onb-beacon-bulk")
    tokens = await issue_token_pair(sub="u-onb-beacon-bulk", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    await client.put("/api/onboarding/dismissals/beacon/b-1", headers=headers)
    await client.put("/api/onboarding/dismissals/beacon/b-2", headers=headers)
    await client.put("/api/onboarding/dismissals/welcome_modal/wm-1", headers=headers)

    response = await client.delete("/api/onboarding/dismissals/beacon", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"deleted_count": 2}

    state = await client.get("/api/onboarding/state", headers=headers)
    remaining = state.json()["dismissals"]
    assert [d["kind"] for d in remaining] == ["welcome_modal"]


async def test_duplicate_activation_insert_is_prevented_by_primary_key(
    platform_stack: Path,
) -> None:
    """AC-001-06: `(tenant_id, user_id, milestone_id)` is the primary key --
    verified at the constraint level, not merely by application logic. A
    plain duplicate INSERT (no ON CONFLICT) must raise a unique-violation;
    the milestone recorder's own ON CONFLICT DO NOTHING usage is TASK-011
    scope, this task only proves the constraint exists and is enforced.
    """
    tenant_id = _unique_tenant("onb-activation")
    user_id = human_principal_iri("u-onb-activation")

    async with tenant_connection(tenant_id) as conn:
        await conn.execute(
            "INSERT INTO activation (tenant_id, user_id, milestone_id, source, activated_at)"
            " VALUES ($1, $2, 'first-entity', 'event', now())",
            tenant_id,
            user_id,
        )

    # Separate transaction (separate request, in practice) -- proves the
    # constraint itself rejects the duplicate, not merely in-transaction
    # application logic that happened to run first.
    with pytest.raises(asyncpg.UniqueViolationError):
        async with tenant_connection(tenant_id) as conn:
            await conn.execute(
                "INSERT INTO activation (tenant_id, user_id, milestone_id, source,"
                " activated_at) VALUES ($1, $2, 'first-entity', 'event', now())",
                tenant_id,
                user_id,
            )



async def test_get_path_resolves_and_persists_from_workspace_role(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-006-01/04: GET resolves the caller's workspace_members role to a
    path via the real active-workspace + membership lookup, and persists it
    so the state row (read by every other surface) agrees on next render.
    """
    from weave_backend.tenancy.members import activate_member, invite_member
    from weave_backend.tenancy.sessions import set_active_workspace
    from weave_backend.tenancy.workspaces import create_workspace

    tenant_id = _unique_tenant("onb-path")
    user_sub = "u-onb-path-compliance"
    email = "compliance@acme-corp.example"

    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Path workspace"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email=email,
            role="compliance_officer",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email=email, user_sub=user_sub
        )
    await set_active_workspace(tenant_id, user_sub, workspace.id)

    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    response = await client.get(
        "/api/onboarding/path", headers={"Authorization": f"Bearer {tokens.access_token}"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "role_path": "compliance",
        "path_variant": "default",
        "path_chosen_manually": False,
        "needs_choice": False,
    }

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT role_path, path_variant FROM onboarding_state"
            " WHERE tenant_id = $1 AND user_id = $2",
            tenant_id,
            human_principal_iri(user_sub),
        )
    assert row is not None
    assert row["role_path"] == "compliance"


async def test_put_path_sets_manual_choice_and_persists_across_reads(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-006-04: "change my onboarding path" persists at any time and every
    subsequent GET (any surface) reflects it, without re-deriving from role.
    """
    tenant_id = _unique_tenant("onb-path-change")
    user_sub = "u-onb-path-change"
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)

    put_response = await client.put(
        "/api/onboarding/path",
        json={"role_path": "technical"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert put_response.status_code == 200
    assert put_response.json() == {
        "role_path": "technical",
        "path_variant": "default",
        "path_chosen_manually": True,
        "needs_choice": False,
    }

    get_response = await client.get(
        "/api/onboarding/path", headers={"Authorization": f"Bearer {tokens.access_token}"}
    )
    assert get_response.json()["role_path"] == "technical"
    assert get_response.json()["path_chosen_manually"] is True


async def test_checklist_dismiss_and_restore_round_trip_via_http(
    client: AsyncClient, platform_stack: Path
) -> None:
    """TASK-010 AC-010-05: dismiss persists; restore clears it back to null
    (the one case `PATCH /state`'s COALESCE contract can't do itself).
    """
    tenant_id = _unique_tenant("onb-checklist-restore")
    tokens = await issue_token_pair(sub="u-onb-restore", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    dismiss_response = await client.patch(
        "/api/onboarding/state",
        json={"checklist_dismissed_at": "2026-01-01T00:00:00Z"},
        headers=headers,
    )
    assert dismiss_response.status_code == 200
    assert dismiss_response.json()["checklist_dismissed_at"] is not None

    restore_response = await client.post("/api/onboarding/checklist/restore", headers=headers)
    assert restore_response.status_code == 200
    assert restore_response.json()["checklist_dismissed_at"] is None

    follow_up = await client.get("/api/onboarding/state", headers=headers)
    assert follow_up.json()["checklist_dismissed_at"] is None


async def test_get_state_exposes_auto_dismiss_default_and_sandbox_fields(
    client: AsyncClient, platform_stack: Path
) -> None:
    """TASK-010 AC-010-04/02: falls back to the documented 7-day default
    when no settings-cascade override exists; sandbox pointer round-trips
    for the "visited the demo" derivation signal.
    """
    tenant_id = _unique_tenant("onb-checklist-defaults")
    tokens = await issue_token_pair(sub="u-onb-defaults", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.get("/api/onboarding/state", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["checklist_auto_dismiss_days"] == 7
    assert body["sandbox_workspace_id"] is None


async def test_self_mark_milestone_is_idempotent_via_http(
    client: AsyncClient, platform_stack: Path
) -> None:
    """TASK-010 AC-010-03 / DoD "double-click => one row": self-mark writes
    an `activation` row with `source=manual`; a repeat call is a no-op, not
    a duplicate row (same PK the poller/recorder rely on, ADR-003).
    """
    tenant_id = _unique_tenant("onb-selfmark")
    user_sub = "u-onb-selfmark"
    user_id = human_principal_iri(user_sub)
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    first = await client.post(
        "/api/onboarding/milestones/invite_admin/self-mark", headers=headers
    )
    second = await client.post(
        "/api/onboarding/milestones/invite_admin/self-mark", headers=headers
    )

    assert first.status_code == 200
    assert first.json() == {"marked": True}
    assert second.status_code == 200
    assert second.json() == {"marked": False}

    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT source FROM activation WHERE tenant_id = $1 AND user_id = $2"
            " AND milestone_id = 'invite_admin'",
            tenant_id,
            user_id,
        )
    assert len(rows) == 1
    assert rows[0]["source"] == "manual"


async def test_self_mark_rejects_non_manual_milestone_id_via_http(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-010-03: the allowlist is enforced end-to-end, not just at the
    unit level -- a poller-owned milestone_id must 404, never write a row.
    """
    tenant_id = _unique_tenant("onb-selfmark-reject")
    tokens = await issue_token_pair(sub="u-onb-selfmark-reject", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.post(
        "/api/onboarding/milestones/first_committed_entity/self-mark", headers=headers
    )

    assert response.status_code == 404
