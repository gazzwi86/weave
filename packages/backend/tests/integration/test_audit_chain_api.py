"""PLAT-TASK-009 integration tests: PLAT-AUDIT-1 against real Postgres/
LocalStack -- append-only trigger (both `weave_app` and the superuser
migration role), tenant scoping, chain verification/tamper detection, and
the `security.*` -> PLAT-NOTIFY-1 fan-out. Marked `integration`/`docker`
per `test_tenancy_isolation.py`'s precedent.
"""

from __future__ import annotations

import os
import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.migrate import _dsn
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair

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


async def _create_workspace_via_route(
    client: AsyncClient, *, tenant_id: str, admin_sub: str, slug: str
) -> tuple[str, dict[str, str]]:
    """Creating a workspace makes `admin_sub` its admin, which -- via
    `is_tenant_admin` -- also satisfies tenant-wide admin gates (same
    pattern `test_billing.py` relies on).
    """
    tokens = await issue_token_pair(sub=admin_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    response = await client.post(
        f"/api/tenants/{tenant_id}/workspaces",
        json={"slug": slug, "display_name": slug},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"], headers


async def test_audit_table_update_rejected_at_db(platform_stack: Path) -> None:
    """AC-3: `weave_app` is rejected at the GRANT layer (no UPDATE/DELETE
    privilege -- belt-and-braces defense) before it ever reaches the
    trigger; see the superuser-role test below for the layer that actually
    matters, since a superuser bypasses GRANTs but not triggers.
    """
    tenant_id = _unique_tenant("tenant-append-only")
    async with tenant_connection(tenant_id) as conn:
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type="workspace.created",
                actor_iri="urn:weave:principal:tenant-append-only:human:alice",
                subject_iri="urn:weave:workspace:tenant-append-only:ws-1",
            ),
        )
        with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
            await conn.execute(
                "UPDATE audit_entries SET hash = 'x' WHERE tenant_id = $1 AND seq = 1", tenant_id
            )


async def test_audit_table_update_rejected_for_superuser_migration_role(
    platform_stack: Path,
) -> None:
    """The brief's explicit concern: migrations run as the superuser role,
    which bypasses RLS/GRANTs but NOT triggers -- proves the same UPDATE is
    rejected on that connection too, without `session_replication_role`
    disabling it.
    """
    tenant_id = _unique_tenant("tenant-append-only-su")
    async with tenant_connection(tenant_id) as conn:
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type="workspace.created",
                actor_iri="urn:weave:principal:tenant-append-only-su:human:alice",
                subject_iri="urn:weave:workspace:tenant-append-only-su:ws-1",
            ),
        )

    su_user = os.environ.get("POSTGRES_MIGRATION_USER", "weave")
    su_conn = await asyncpg.connect(_dsn(su_user))
    try:
        with pytest.raises(asyncpg.exceptions.RaiseError, match="audit_entries is append-only"):
            await su_conn.execute(
                "UPDATE audit_entries SET hash = 'x' WHERE tenant_id = $1 AND seq = 1", tenant_id
            )
    finally:
        await su_conn.close()


async def test_audit_entries_tenant_scoped(client: AsyncClient) -> None:
    """AC-5: an admin from tenant B receives zero entries for tenant A, and
    a mismatched `tenant_id` query param is rejected outright.
    """
    tenant_a = _unique_tenant("tenant-a-audit")
    tenant_b = _unique_tenant("tenant-b-audit")
    await _create_workspace_via_route(
        client, tenant_id=tenant_a, admin_sub="u-admin-a", slug="ws-a"
    )
    _, headers_b = await _create_workspace_via_route(
        client, tenant_id=tenant_b, admin_sub="u-admin-b", slug="ws-b"
    )

    same_tenant = await client.get(
        "/api/audit", params={"tenant_id": tenant_b}, headers=headers_b
    )
    assert same_tenant.status_code == 200, same_tenant.text
    assert same_tenant.json()["total"] == 1

    cross_tenant = await client.get(
        "/api/audit", params={"tenant_id": tenant_a}, headers=headers_b
    )
    assert cross_tenant.status_code == 403
    assert cross_tenant.json()["detail"]["error"] == "tenant_mismatch"


async def test_cross_tenant_audit_isolation(client: AsyncClient) -> None:
    """Verification for tenant A never sees tenant B's entries, even though
    both chains exist in the same table.
    """
    tenant_a = _unique_tenant("tenant-a-chain")
    tenant_b = _unique_tenant("tenant-b-chain")
    _, headers_a = await _create_workspace_via_route(
        client, tenant_id=tenant_a, admin_sub="u-admin-a", slug="ws-a"
    )
    await _create_workspace_via_route(
        client, tenant_id=tenant_b, admin_sub="u-admin-b", slug="ws-b"
    )
    await _create_workspace_via_route(
        client, tenant_id=tenant_b, admin_sub="u-admin-b", slug="ws-b2"
    )

    verify_a = await client.post("/api/audit/verify", headers=headers_a)
    assert verify_a.status_code == 200, verify_a.text
    body = verify_a.json()
    assert body["valid"] is True
    # Tenant A only ever emitted one entry -- if tenant B's rows leaked into
    # the chain, this count would be 3 instead of 1.
    assert body["entries_checked"] == 1

    entries_a = await client.get("/api/audit", params={"tenant_id": tenant_a}, headers=headers_a)
    assert entries_a.json()["total"] == 1


async def test_audit_chain_verification(client: AsyncClient) -> None:
    """AC-4: a multi-entry chain verifies as valid, then tampering a single
    entry's hash directly in Postgres (bypassing the append-only trigger via
    `session_replication_role = replica`, the standard Postgres idiom for
    test-setup tampering) is detected at the exact tampered seq.
    """
    tenant_id = _unique_tenant("tenant-verify")
    _, headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin", slug="ws-verify"
    )
    for i in range(4):
        response = await client.put(
            "/api/settings/theme",
            json={"scope_iri": f"urn:weave:tenant:{tenant_id}:company", "value": f"v{i}"},
            headers=headers,
        )
        assert response.status_code == 200, response.text

    valid_result = await client.post("/api/audit/verify", headers=headers)
    assert valid_result.json() == {
        "valid": True,
        "entries_checked": 5,
        "first_broken_seq": None,
        "error": None,
    }

    su_user = os.environ.get("POSTGRES_MIGRATION_USER", "weave")
    su_conn = await asyncpg.connect(_dsn(su_user))
    try:
        await su_conn.execute("SET session_replication_role = replica")
        await su_conn.execute(
            "UPDATE audit_entries SET hash = repeat('0', 64) WHERE tenant_id = $1 AND seq = 3",
            tenant_id,
        )
        await su_conn.execute("SET session_replication_role = default")
    finally:
        await su_conn.close()

    broken_result = await client.post("/api/audit/verify", headers=headers)
    broken_body = broken_result.json()
    assert broken_body["valid"] is False
    assert broken_body["first_broken_seq"] == 3


async def test_security_event_triggers_notification(client: AsyncClient) -> None:
    """AC-6: a `security.*` event fans out an in-app notification to the
    tenant's admin(s) via PLAT-NOTIFY-1.
    """
    tenant_id = _unique_tenant("tenant-security")
    _, headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin-sec", slug="ws-sec"
    )
    actor_iri = "urn:weave:principal:agent:intruder"
    target_iri = f"urn:weave:workspace:{tenant_id}:ws-sec"
    async with tenant_connection(tenant_id) as conn:
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type="security.permission.escalation",
                actor_iri=actor_iri,
                subject_iri=target_iri,
                payload={"attempted_role": "admin"},
            ),
        )

    notifications = await client.get("/api/notifications", headers=headers)
    assert notifications.status_code == 200, notifications.text
    events = [n["event_type"] for n in notifications.json()["notifications"]]
    assert "security.permission.escalation" in events
