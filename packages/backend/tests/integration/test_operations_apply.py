"""CE-TASK-001 integration tests: the full CE-WRITE-1 mutation pipeline
against a real Oxigraph + Postgres + Redis stack (AC-001-01/-07/-08/-09/-10).

E2E deviation (recorded, same call as `test_workspace_switch_e2e.py`'s
precedent): the brief asks for the two E2E rows (valid mutation reflects in
the graph; violating mutation surfaces a 422) as Playwright specs, but no
mutation UI exists yet (CE-TASK-006). This codebase's established pattern
for "no UI yet" E2E slots is an API-level test through the real FastAPI app
(`httpx.ASGITransport`) against real docker-compose services, marked
`pytest.mark.e2e` alongside `integration`/`docker` -- not a mocked-network
Playwright spec (PROJ-006 already bans mocked-network e2e; a fresh
harness-bootstrap endpoint to give Playwright an HTTP-only setup path would
duplicate this precedent, not improve on it). `test_valid_mutation_...` and
`test_shacl_violation_...` below are marked `e2e` for that reason. Replace
with a browser-driven Playwright spec once TASK-006 ships the authoring UI.
"""

from __future__ import annotations

import json
import shutil
import time
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from rdflib import RDF, Graph, Namespace

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import agent_sub
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.keys import KEY_ID, PRIVATE_KEY
from weave_backend.mock_oidc.tokens import ISSUER, issue_token_pair
from weave_backend.operations import outbox, pipeline
from weave_backend.operations.idempotency import release_lock, try_acquire_lock
from weave_backend.operations.provenance import prov_graph_iri
from weave_backend.rdf.oxigraph_client import clear_graph, fetch_graph_turtle
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.sessions import get_redis
from weave_backend.tenancy.workspaces import Workspace, create_workspace

#: PLAT-TASK-004's LocalStack STS emulator resolves every session token to
#: this fixed root identity (verified empirically, see test_identity_rbac.py).
_ROOT_ARN = "arn:aws:iam::000000000000:root"

WEAVE = Namespace("https://weave.io/ontology/")

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


async def _make_workspace(tenant_id: str, *, label: str) -> Workspace:
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug=label, display_name=label
        )
    return workspace


async def _add_member(
    tenant_id: str, workspace_id: str, *, user_sub: str, role: str, email: str
) -> None:
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn, tenant_id=tenant_id, workspace_id=workspace_id, email=email, role=role
        )
        await activate_member(conn, workspace_id=workspace_id, email=email, user_sub=user_sub)


async def _authed_client(
    client: AsyncClient, *, tenant_id: str, user_sub: str, workspace_id: str
) -> dict[str, str]:
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch_response = await client.post(f"/api/workspaces/{workspace_id}/switch", headers=headers)
    assert switch_response.status_code == 200
    return headers


def _valid_operations() -> list[dict[str, object]]:
    return [
        {"op": "add_node", "ref": "a1", "kind": "Actor", "label": "Billing Team"},
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"},
        {"op": "add_edge", "subject_ref": "p1", "predicate": "performedBy", "object_ref": "a1"},
    ]


async def test_valid_mutation_commits_new_version_and_reflects_in_the_graph(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-01/-010 -- also this task's E2E row: a valid mutation, applied
    through the real HTTP endpoint, is visible in the real working graph.
    """
    tenant_id = _unique_tenant("ops-valid")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )

    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )

        assert response.status_code == 201
        body = response.json()
        assert body["applied_count"] == 3
        assert body["version_iri"].startswith(f"{workspace.named_graph_iri}:v")
        assert body["activity_iri"]

        turtle = await fetch_graph_turtle(workspace.named_graph_iri)
        assert "Invoicing" in turtle
        assert "performedBy" in turtle

        async with tenant_connection(tenant_id) as conn:
            rows = await conn.fetch(
                "SELECT event_type, engine, target_iri, diff_summary FROM audit_entries"
                " WHERE tenant_id = $1",
                tenant_id,
            )
        assert len(rows) == 1
        assert rows[0]["event_type"] == "operations.applied"
        # PR #20 finding 3: every CE-emitted audit entry must be attributed
        # to the emitting engine, not the "platform" default.
        assert rows[0]["engine"] == "constitution"
        assert rows[0]["target_iri"] == body["version_iri"]
        diff_summary = json.loads(rows[0]["diff_summary"])
        assert diff_summary["target_graph_iri"] == workspace.named_graph_iri
        assert diff_summary["activity_iri"] == body["activity_iri"]
        assert diff_summary["applied_count"] == 3
        assert diff_summary["claimed_actor_iri"] == "urn:weave:principal:test-actor"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_flush_failure_never_500s_an_already_committed_mutation(
    client: AsyncClient, platform_stack: Path
) -> None:
    """PR #23 finding #4: the post-commit `outbox.flush_pending` call is a
    best-effort delivery attempt (AC-002-04) -- the mutation it flushes for
    has already committed, so a pool-acquire or SELECT failure there must
    never surface as a 500. The event stays enqueued, pending, for the next
    flush; nothing here should re-raise.
    """
    tenant_id = _unique_tenant("ops-flush-fail")
    workspace = await _make_workspace(tenant_id, label="ops-flush")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )

    try:
        with patch.object(
            outbox, "flush_pending", AsyncMock(side_effect=ConnectionError("pool exhausted"))
        ):
            response = await client.post(
                "/api/operations/apply",
                json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
                headers=headers,
            )

        assert response.status_code == 201
        body = response.json()
        assert body["applied_count"] == 3

        # The mutation itself still committed, and its audit entry is still
        # pending for the next flush -- nothing was dropped.
        async with tenant_connection(tenant_id) as conn:
            pending = await conn.fetch(
                "SELECT event_type FROM audit_outbox WHERE tenant_id = $1 AND delivered_at IS NULL",
                tenant_id,
            )
        assert len(pending) == 1
        assert pending[0]["event_type"] == "operations.applied"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_shacl_violation_returns_422_and_leaves_working_graph_unchanged(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-02/-010 -- also this task's second E2E row."""
    tenant_id = _unique_tenant("ops-violate")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )

    try:
        pre_state = await fetch_graph_turtle(workspace.named_graph_iri)

        # A Process with no `performedBy` -- trips ProcessShape's Violation.
        response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"}
                ],
                "actor": "urn:weave:principal:test-actor",
            },
            headers=headers,
        )

        assert response.status_code == 422
        assert response.json()["violations"]

        post_state = await fetch_graph_turtle(workspace.named_graph_iri)
        assert post_state == pre_state
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_partial_update_round_trip_preserves_untouched_triples(
    client: AsyncClient, platform_stack: Path
) -> None:
    """DoD: "partial-update round-trip preserves untouched triples
    (integration-verified)" -- two real, separate mutations against the real
    working graph (AC-001-06).
    """
    tenant_id = _unique_tenant("ops-partial")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )

    try:
        create_response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert create_response.status_code == 201

        turtle = await fetch_graph_turtle(workspace.named_graph_iri)
        graph = Graph()
        graph.parse(data=turtle, format="turtle")
        process_iri = str(next(graph.subjects(RDF.type, WEAVE.Process)))

        update_response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    {
                        "op": "update_node",
                        "iri": process_iri,
                        "properties": {"label": "Invoicing (renamed)"},
                    }
                ],
                "actor": "urn:weave:principal:test-actor",
            },
            headers=headers,
        )
        assert update_response.status_code == 201

        final_turtle = await fetch_graph_turtle(workspace.named_graph_iri)
        assert "Invoicing (renamed)" in final_turtle
        # The performedBy edge asserted in the first mutation was never
        # named by the update -- it must survive untouched.
        assert "performedBy" in final_turtle
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_idempotent_replay_returns_original_response_without_reapplying(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-04."""
    tenant_id = _unique_tenant("ops-idem")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )
    idempotency_key = f"idem-{uuid.uuid4().hex}"

    try:
        payload = {
            "operations": _valid_operations(),
            "actor": "urn:weave:principal:test-actor",
            "idempotency_key": idempotency_key,
        }
        first = await client.post("/api/operations/apply", json=payload, headers=headers)
        second = await client.post("/api/operations/apply", json=payload, headers=headers)

        assert first.status_code == 201
        assert second.status_code == 201
        assert first.json() == second.json()

        async with tenant_connection(tenant_id) as conn:
            rows = await conn.fetch(
                "SELECT event_type FROM audit_entries WHERE tenant_id = $1", tenant_id
            )
        # Fix 1 (idempotent replay): the cached-response replay must not
        # re-run `_apply_uncached`, so exactly one `operations.applied` entry
        # exists even though the client posted twice.
        applied = [r for r in rows if r["event_type"] == "operations.applied"]
        assert len(applied) == 1
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_missing_jwt_returns_401_before_any_graph_operation(client: AsyncClient) -> None:
    """AC-001-07."""
    response = await client.post(
        "/api/operations/apply",
        json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
    )
    assert response.status_code == 401


async def test_expired_jwt_returns_401(client: AsyncClient) -> None:
    """AC-001-07."""
    now = int(time.time())
    expired_claims = {
        "sub": "u-expired",
        "tenant_id": "tenant-expired",
        "principal_iri": "urn:weave:principal:human:u-expired",
        "principal_type": "human",
        "iss": ISSUER,
        "aud": "weave-dev",
        "iat": now - 600,
        "exp": now - 1,
    }
    expired_token = jwt.encode(
        expired_claims, PRIVATE_KEY, algorithm="RS256", headers={"kid": KEY_ID}
    )

    response = await client.post(
        "/api/operations/apply",
        json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401


async def test_read_only_role_gets_403_not_write_access(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-08."""
    tenant_id = _unique_tenant("ops-forbidden")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-reader", role="read", email="reader@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-reader", workspace_id=workspace.id
    )

    response = await client.post(
        "/api/operations/apply",
        json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
        headers=headers,
    )

    assert response.status_code == 403

    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT event_type FROM audit_entries WHERE tenant_id = $1", tenant_id
        )
    # PR #20 finding 4: a routine RBAC denial isn't `security.*` -- that
    # prefix fans out an admin alert for every hit, which a read-only
    # member hitting a write route doesn't warrant. The audit entry itself
    # is still mandatory.
    assert rows[0]["event_type"] == "access.rbac.denied"


async def test_forged_cross_tenant_target_is_rejected(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-09 / ADR-001-tenant-isolation: a well-formed version IRI naming
    another tenant's graph is a 403 + audit, never a 400 -- a 400 would look
    like an accident (client typo); this is a forgery attempt.
    """
    tenant_a = _unique_tenant("ops-tenant-a")
    tenant_b = _unique_tenant("ops-tenant-b")
    workspace_a = await _make_workspace(tenant_a, label="ops")
    workspace_b = await _make_workspace(tenant_b, label="ops")
    await _add_member(
        tenant_a, workspace_a.id, user_sub="u-a", role="author", email="a@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_a, user_sub="u-a", workspace_id=workspace_a.id
    )

    forged_target = f"{workspace_b.named_graph_iri}:v0.1.0"
    response = await client.post(
        "/api/operations/apply",
        json={
            "operations": _valid_operations(),
            "actor": "urn:weave:principal:test-actor",
            "target": forged_target,
        },
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "cross_tenant_target"

    async with tenant_connection(tenant_a) as conn:
        rows = await conn.fetch(
            "SELECT event_type, target_iri FROM audit_entries WHERE tenant_id = $1", tenant_a
        )
    assert rows[0]["event_type"] == "security.cross_tenant.rejected"
    assert rows[0]["target_iri"] == forged_target


async def test_malformed_target_string_still_returns_400_no_audit(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Fix 2 boundary: a target that isn't even a recognisable version IRI
    shape (not a forged foreign graph, just garbage) stays a plain 400 with
    no audit entry -- distinguishing "malformed" from "forged" is the point.
    """
    tenant_id = _unique_tenant("ops-malformed")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )

    response = await client.post(
        "/api/operations/apply",
        json={
            "operations": _valid_operations(),
            "actor": "urn:weave:principal:test-actor",
            "target": "not-a-recognisable-target",
        },
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "invalid_target"

    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT event_type FROM audit_entries WHERE tenant_id = $1", tenant_id
        )
    assert rows == []


async def test_recorded_actor_is_the_authenticated_principal_even_when_body_names_someone_else(
    client: AsyncClient, platform_stack: Path
) -> None:
    """PR #20 finding 1: `actor` in the request body is client-supplied and
    must never be trusted as the audit/PROV actor -- only the JWT-
    authenticated principal is. Post with a spoofed `actor` and confirm both
    the audit entry and the PROV activity record the real principal, with
    the spoofed value kept only as secondary context in the audit payload.
    """
    tenant_id = _unique_tenant("ops-spoof")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )
    real_principal = "urn:weave:principal:user:u-author"
    spoofed_actor = "urn:weave:principal:user:someone-else-entirely"

    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": spoofed_actor},
            headers=headers,
        )
        assert response.status_code == 201

        async with tenant_connection(tenant_id) as conn:
            rows = await conn.fetch(
                "SELECT actor_principal_iri, diff_summary FROM audit_entries"
                " WHERE tenant_id = $1 AND event_type = 'operations.applied'",
                tenant_id,
            )
        assert rows[0]["actor_principal_iri"] == real_principal
        diff_summary = json.loads(rows[0]["diff_summary"])
        assert diff_summary["claimed_actor_iri"] == spoofed_actor

        prov_turtle = await fetch_graph_turtle(prov_graph_iri(workspace.named_graph_iri))
        assert real_principal in prov_turtle
        assert spoofed_actor not in prov_turtle
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_idempotent_replay_of_a_violating_batch_returns_422_both_times(
    client: AsyncClient, platform_stack: Path
) -> None:
    """PR #20 finding 2a: a violating batch's outcome must be cached too --
    the second POST with the same idempotency key replays the same 422, not
    a 500 (previously only `ApplyResponse` outcomes were cached, so a
    replayed violation had nothing valid to reconstruct).
    """
    tenant_id = _unique_tenant("ops-idem-422")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )
    idempotency_key = f"idem-422-{uuid.uuid4().hex}"
    payload = {
        "operations": [{"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"}],
        "actor": "urn:weave:principal:test-actor",
        "idempotency_key": idempotency_key,
    }

    first = await client.post("/api/operations/apply", json=payload, headers=headers)
    second = await client.post("/api/operations/apply", json=payload, headers=headers)

    assert first.status_code == 422
    assert second.status_code == 422
    assert first.json() == second.json()


async def test_slow_concurrent_holder_returns_409_not_500(
    client: AsyncClient, platform_stack: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PR #20 finding 2b: a caller racing an idempotency key whose lock is
    held but never released (e.g. the first caller's process crashed) must
    see a 409, not a raw 500 from an unhandled `TimeoutError`. Poll window
    shrunk here for a fast test -- production aligns it to the lock TTL
    (`pipeline.py` module docstring).
    """
    monkeypatch.setattr(pipeline, "_POLL_ATTEMPTS", 3)
    monkeypatch.setattr(pipeline, "_POLL_INTERVAL_SECONDS", 0.01)

    tenant_id = _unique_tenant("ops-stuck-lock")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )
    idempotency_key = f"stuck-{uuid.uuid4().hex}"

    # `redis.Redis` doesn't structurally match the `RedisLike` Protocol under
    # mypy (same reason `pipeline.py` types this `Any`); it's the real client
    # at runtime, which is what matters here.
    redis_client: Any = get_redis()
    assert await try_acquire_lock(redis_client, tenant_id, idempotency_key)
    try:
        response = await client.post(
            "/api/operations/apply",
            json={
                "operations": _valid_operations(),
                "actor": "urn:weave:principal:test-actor",
                "idempotency_key": idempotency_key,
            },
            headers=headers,
        )
        assert response.status_code == 409
        assert response.json()["detail"]["error"] == "concurrent_apply_in_progress"
    finally:
        await release_lock(redis_client, tenant_id, idempotency_key)


async def test_spike_run_mode_write_back_is_rejected(
    client: AsyncClient, platform_stack: Path
) -> None:
    """XT-002 / ADR-003: a Build Engine run tagged `run_mode: "spike"` may
    never write back to CE-WRITE-1, even with a valid, well-formed payload
    and a real author-role JWT.
    """
    tenant_id = _unique_tenant("ops-spike")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )

    response = await client.post(
        "/api/operations/apply",
        json={
            "operations": _valid_operations(),
            "actor": "urn:weave:principal:test-actor",
            "run_mode": "spike",
        },
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "spike_write_back_forbidden"


async def test_agent_jwt_with_author_role_can_write_via_apply(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-003-12: a service-account (agent) JWT from another Weave engine is
    accepted on CE-WRITE-1 the same way a human author's JWT is -- RBAC
    never branches on `principal_type` (see `rbac.py`'s own docstring), it
    only ever checks the caller's `workspace_members` role. The agent is
    granted that role the same way a human is: an admin adds its
    deterministic sub (`agent_sub`) as an author-role member.
    """
    tenant_id = _unique_tenant("ops-agent")
    workspace = await _make_workspace(tenant_id, label="ops")
    agent_principal_sub = agent_sub(_ROOT_ARN)
    await _add_member(
        tenant_id,
        workspace.id,
        user_sub=agent_principal_sub,
        role="author",
        email="agent@example.invalid",
    )

    token_response = await client.post(
        "/api/auth/agent-token",
        json={"sts_token": "any-session-token", "workspace_id": workspace.id},
    )
    assert token_response.status_code == 200, token_response.text
    headers = {"Authorization": f"Bearer {token_response.json()['agent_token']}"}
    switch_response = await client.post(
        f"/api/workspaces/{workspace.id}/switch", headers=headers
    )
    assert switch_response.status_code == 200

    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert response.status_code == 201, response.text
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_agent_jwt_without_write_scope_gets_403_not_write_access(
    client: AsyncClient, platform_stack: Path
) -> None:
    """QA edge case (AC-003-12 negative path): the happy-path test above only
    proves an agent JWT *with* an author-role membership can write. AC-003-12
    is conditional ("...if the service account has write scope") -- an agent
    JWT that only has `read`-role membership (the service-account equivalent
    of a read-only human) must still be rejected, the same way
    `test_read_only_role_gets_403_not_write_access` proves for a human. RBAC
    never branches on `principal_type` (see `rbac.py`), so this exercises the
    same `enforce_workspace_role` check via the agent-token path specifically.
    """
    tenant_id = _unique_tenant("ops-agent-ro")
    workspace = await _make_workspace(tenant_id, label="ops")
    agent_principal_sub = agent_sub(_ROOT_ARN)
    await _add_member(
        tenant_id,
        workspace.id,
        user_sub=agent_principal_sub,
        role="read",
        email="agent-ro@example.invalid",
    )

    token_response = await client.post(
        "/api/auth/agent-token",
        json={"sts_token": "any-session-token", "workspace_id": workspace.id},
    )
    assert token_response.status_code == 200, token_response.text
    headers = {"Authorization": f"Bearer {token_response.json()['agent_token']}"}
    switch_response = await client.post(
        f"/api/workspaces/{workspace.id}/switch", headers=headers
    )
    assert switch_response.status_code == 200

    response = await client.post(
        "/api/operations/apply",
        json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "forbidden"
