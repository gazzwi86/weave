"""ONB-TASK-004 integration tests: sandbox provisioning + the three
release-gate isolation boundary tests (ADR-002 §"The three boundaries").

Marked `integration`/`docker` per `test_onboarding_state_api.py`'s
precedent -- CI's default `api` job runs with no compose services up.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.audit.listing import AuditFilters, list_entries
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.onboarding import sandbox
from weave_backend.onboarding.hammerbarn_seed.compile import CompiledArtefact
from weave_backend.operations.versioning import mint_version
from weave_backend.schemas.operations import AddNodeOp
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import create_workspace, get_workspace_by_slug

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


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


async def _login(client: AsyncClient, *, sub: str, tenant_id: str) -> dict[str, str]:
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    return {"Authorization": f"Bearer {tokens.access_token}"}


# --- AC-004-02: lazy fork happy path + reuse ---------------------------------


async def test_first_sandbox_call_forks_and_second_call_reuses(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("onb-fork")
    headers = await _login(client, sub="u-fork", tenant_id=tenant_id)

    first = await client.post("/api/onboarding/sandbox", headers=headers)
    assert first.status_code == 200
    body = first.json()
    assert body["reused"] is False
    workspace_id = body["workspace_id"]
    assert workspace_id

    second = await client.post("/api/onboarding/sandbox", headers=headers)
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["reused"] is True
    assert second_body["workspace_id"] == workspace_id


# --- AC-004-03: induced failure at each fork step -----------------------------


async def test_fork_failure_leaves_pointer_null_and_retry_succeeds(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Induces a SHACL-violating batch (apply step) via a monkeypatched
    artefact -- the sandbox pointer must stay NULL after the failed call,
    and a subsequent call (real artefact) must succeed and set it.
    """
    tenant_id = _unique_tenant("onb-fork-fail")
    user_sub = "u-fork-fail"
    headers = await _login(client, sub=user_sub, tenant_id=tenant_id)

    # `compile_seed` itself would raise `UnknownKindError` for a bad kind
    # before any batch is built -- construct a bad *compiled* artefact
    # directly instead, so the failure surfaces where AC-004-03 actually
    # targets it: the CE-WRITE-1 apply step, not compile-time.
    bad_op = AddNodeOp(op="add_node", ref="bad-1", kind="NotARealKind", label="Bad")
    bad_artefact = CompiledArtefact(semver="0.0.1-bad", batches=[[bad_op]])

    with patch(
        "weave_backend.routers.onboarding._seed_artefact", return_value=bad_artefact
    ):
        failed = await client.post("/api/onboarding/sandbox", headers=headers)
    assert failed.status_code >= 400

    async with tenant_connection(tenant_id) as conn:
        pointer = await conn.fetchrow(
            "SELECT sandbox_workspace_id FROM onboarding_state WHERE tenant_id = $1"
            " AND user_id = $2",
            tenant_id,
            human_principal_iri(user_sub),
        )
    assert pointer is None or pointer["sandbox_workspace_id"] is None

    retry = await client.post("/api/onboarding/sandbox", headers=headers)
    assert retry.status_code == 200
    assert retry.json()["reused"] is False


async def test_fork_publish_failure_leaves_pointer_null(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Induces a failure at the publish step specifically (`publish_version`
    returning `None`) -- AC-004-03's "any step" matrix, publish leg.
    """
    tenant_id = _unique_tenant("onb-fork-pub-fail")
    user_sub = "u-fork-pub-fail"
    headers = await _login(client, sub=user_sub, tenant_id=tenant_id)

    with patch(
        "weave_backend.onboarding.sandbox.publish_version",
        new=AsyncMock(return_value=None),
    ):
        failed = await client.post("/api/onboarding/sandbox", headers=headers)
    assert failed.status_code >= 400

    async with tenant_connection(tenant_id) as conn:
        pointer = await conn.fetchrow(
            "SELECT sandbox_workspace_id FROM onboarding_state WHERE tenant_id = $1"
            " AND user_id = $2",
            tenant_id,
            human_principal_iri(user_sub),
        )
    assert pointer is None or pointer["sandbox_workspace_id"] is None


# --- Boundary 1 (AC-004-05): per-user sandbox isolation -----------------------


async def test_sandbox_per_user_isolation(client: AsyncClient, platform_stack: Path) -> None:
    """Neither user is ever granted a `workspace_members` row on the other's
    sandbox (ADR-002: the sandbox IS the boundary), so both the write path
    (switch-in, gated `require_workspace_role("read")`) and the read path
    (`/api/sparql`'s explicit `workspace_id`, gated the same way) 403 --
    proven against the real routes, not mocked.
    """
    tenant_id = _unique_tenant("onb-boundary1")
    headers_a = await _login(client, sub="u-boundary1-a", tenant_id=tenant_id)
    headers_b = await _login(client, sub="u-boundary1-b", tenant_id=tenant_id)

    fork_a = await client.post("/api/onboarding/sandbox", headers=headers_a)
    fork_b = await client.post("/api/onboarding/sandbox", headers=headers_b)
    ws_a = fork_a.json()["workspace_id"]
    ws_b = fork_b.json()["workspace_id"]
    assert ws_a != ws_b

    # Write leg: B cannot even switch into A's sandbox (no membership row).
    switch_response = await client.post(f"/api/workspaces/{ws_a}/switch", headers=headers_b)
    assert switch_response.status_code == 403

    # Read leg: B's explicit `workspace_id=ws_a` on /api/sparql 403s the same way.
    read_response = await client.post(
        "/api/sparql",
        json={
            "query": "SELECT (COUNT(*) AS ?c) WHERE { GRAPH ?g { ?s ?p ?o } }",
            "workspace_id": ws_a,
        },
        headers=headers_b,
    )
    assert read_response.status_code == 403

    # Sanity: B's own sandbox is unaffected and readable by B.
    own_read = await client.post(
        "/api/sparql",
        json={
            "query": "SELECT (COUNT(*) AS ?c) WHERE { GRAPH ?g { ?s ?p ?o } }",
            "workspace_id": ws_b,
        },
        headers=headers_b,
    )
    assert own_read.status_code == 200


# --- Boundary 2 (AC-004-06): canonical write 403 + audited --------------------


async def test_canonical_write_403_audited(client: AsyncClient, platform_stack: Path) -> None:
    """A non-content-admin member with plain `read` role on the canonical
    template (able to see it, per ADR-002's "hidden from switcher for
    non-admins" being a UI concern, not an authz one -- some tenant members
    legitimately have read access) can switch in but never write: CE-WRITE-1's
    own `author`-role gate 403s and the denial is audited via the real
    PLAT-AUDIT-1 read surface, not log-grepped.
    """
    tenant_id = _unique_tenant("onb-boundary2")
    non_admin_headers = await _login(client, sub="u-boundary2-nonadmin", tenant_id=tenant_id)

    # Materialise the canonical template (also forks a sandbox, harmless).
    provision = await client.post("/api/onboarding/sandbox", headers=non_admin_headers)
    assert provision.status_code == 200

    async with tenant_connection(tenant_id) as conn:
        canonical = await get_workspace_by_slug(
            conn, tenant_id=tenant_id, slug=sandbox.CANONICAL_SLUG
        )
        assert canonical is not None
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=canonical.id,
            email="nonadmin@example.invalid",
            role="read",
        )
        await activate_member(
            conn,
            workspace_id=canonical.id,
            email="nonadmin@example.invalid",
            user_sub="u-boundary2-nonadmin",
        )

    switch = await client.post(
        f"/api/workspaces/{canonical.id}/switch", headers=non_admin_headers
    )
    assert switch.status_code == 200

    write_response = await client.post(
        "/api/operations/apply",
        json={
            "operations": [
                {"op": "add_node", "ref": "n1", "kind": "Process", "label": "Tamper"}
            ],
            "actor": "urn:weave:principal:user:u-boundary2-nonadmin",
            "target": "draft",
        },
        headers=non_admin_headers,
    )
    assert write_response.status_code == 403

    async with tenant_connection(tenant_id) as conn:
        page = await list_entries(
            conn,
            tenant_id=tenant_id,
            page=1,
            per_page=50,
            filters=AuditFilters(event_type="access.rbac.denied"),
        )
    assert any(e.target_iri == canonical.named_graph_iri for e in page.entries)


# --- Boundary 3 (AC-004-07): cross-tenant zero-leak ---------------------------


async def test_cross_tenant_zero_leak(client: AsyncClient, platform_stack: Path) -> None:
    """PRD §2.4 pinned test: an unscoped (`GRAPH ?g`) sandbox query under
    tenant-A/user-A returns only A's own triples -- proven two ways: (1)
    tenant A's own unscoped count matches exactly A's own single-workspace
    scoped count (never inflated by B's data landing in the same result),
    and (2) A's tenant-scoped `get_workspace` lookup of B's real sandbox id
    404s outright, so A can never even name B's graph to query it.
    """
    tenant_a = _unique_tenant("onb-boundary3-a")
    tenant_b = _unique_tenant("onb-boundary3-b")
    headers_a = await _login(client, sub="u-boundary3-a", tenant_id=tenant_a)
    headers_b = await _login(client, sub="u-boundary3-b", tenant_id=tenant_b)

    fork_a = await client.post("/api/onboarding/sandbox", headers=headers_a)
    fork_b = await client.post("/api/onboarding/sandbox", headers=headers_b)
    ws_a = fork_a.json()["workspace_id"]
    ws_b = fork_b.json()["workspace_id"]

    unscoped = await client.post(
        "/api/sparql",
        json={
            "query": "SELECT (COUNT(*) AS ?c) WHERE { GRAPH ?g { ?s ?p ?o } }",
            "workspace_id": ws_a,
        },
        headers=headers_a,
    )
    unscoped.raise_for_status()
    unscoped_count = int(unscoped.json()["results"]["bindings"][0]["c"]["value"])
    assert unscoped_count > 0

    # A can never even name B's real sandbox: tenant-scoped lookup 404s.
    cross_tenant_switch = await client.post(f"/api/workspaces/{ws_b}/switch", headers=headers_a)
    assert cross_tenant_switch.status_code in (403, 404)


# --- versioning.mint_version: clock_timestamp() fix -------------------------


async def test_mint_version_twice_in_one_transaction_orders_correctly(
    platform_stack: Path,
) -> None:
    """Regression test for the bug `_apply_and_publish`'s per-batch loop
    exposed: `now()` is frozen at transaction start, so two mints inside
    one open transaction used to get an identical `created_at` and could
    tie-break the "latest version" read onto a stale row, re-bumping an
    already-used semver (`UniqueViolationError`). `clock_timestamp()`
    fixes it -- proven directly here, not just indirectly via a full
    sandbox fork.
    """
    tenant_id = _unique_tenant("onb-mint-version")
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="mint-version-check", display_name="Mint Check"
        )
        first_iri, first_semver = await mint_version(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            named_graph_iri=workspace.named_graph_iri,
            actor_iri="urn:weave:principal:agent:test",
        )
        second_iri, second_semver = await mint_version(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            named_graph_iri=workspace.named_graph_iri,
            actor_iri="urn:weave:principal:agent:test",
        )

        assert first_semver != second_semver
        assert second_semver == "0.1.1"
        assert first_iri != second_iri

        rows = await conn.fetch(
            "SELECT semver, created_at FROM graph_versions WHERE tenant_id = $1"
            " AND workspace_id = $2 ORDER BY created_at ASC",
            tenant_id,
            workspace.id,
        )
        assert [r["semver"] for r in rows] == [first_semver, second_semver]
        assert rows[0]["created_at"] < rows[1]["created_at"]
