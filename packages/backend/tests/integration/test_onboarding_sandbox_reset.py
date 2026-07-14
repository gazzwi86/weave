"""ONB-TASK-005 integration tests: blue/green sandbox reset.

Marked `integration`/`docker` per `test_onboarding_sandbox.py`'s precedent --
CI's default `api` job runs with no compose services up.
"""

from __future__ import annotations

import asyncio
import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.onboarding.hammerbarn_seed.compile import CompiledArtefact
from weave_backend.schemas.operations import AddNodeOp

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


# --- AC-005-02: sandbox must already exist ------------------------------------


async def test_reset_before_first_fork_is_rejected(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("onb-reset-none")
    headers = await _login(client, sub="u-reset-none", tenant_id=tenant_id)

    response = await client.post("/api/onboarding/sandbox/reset", headers=headers)
    assert response.status_code == 409


# --- AC-005-02/03: success swaps pointer, clears exercises, preserves activation --


async def test_reset_success_bumps_pointer_clears_exercises_preserves_activation(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("onb-reset-ok")
    user_sub = "u-reset-ok"
    headers = await _login(client, sub=user_sub, tenant_id=tenant_id)
    user_iri = human_principal_iri(user_sub)

    fork = await client.post("/api/onboarding/sandbox", headers=headers)
    assert fork.status_code == 200
    old_workspace_id = fork.json()["workspace_id"]

    async with tenant_connection(tenant_id) as conn:
        await conn.execute(
            "INSERT INTO exercise_completion (tenant_id, user_id, exercise_id,"
            " verified_signal, completed_at) VALUES ($1, $2, 'ex-1', 'nav_signal', now())",
            tenant_id,
            user_iri,
        )
        await conn.execute(
            "INSERT INTO activation (tenant_id, user_id, milestone_id, source, activated_at)"
            " VALUES ($1, $2, 'm-1', 'manual', now())",
            tenant_id,
            user_iri,
        )

    reset = await client.post("/api/onboarding/sandbox/reset", headers=headers)
    assert reset.status_code == 200
    body = reset.json()
    new_workspace_id = body["workspace_id"]
    assert new_workspace_id != old_workspace_id

    async with tenant_connection(tenant_id) as conn:
        state = await conn.fetchrow(
            "SELECT sandbox_workspace_id FROM onboarding_state WHERE tenant_id = $1"
            " AND user_id = $2",
            tenant_id,
            user_iri,
        )
        assert str(state["sandbox_workspace_id"]) == new_workspace_id

        exercises = await conn.fetch(
            "SELECT exercise_id FROM exercise_completion WHERE tenant_id = $1 AND user_id = $2",
            tenant_id,
            user_iri,
        )
        assert exercises == []

        activations = await conn.fetch(
            "SELECT milestone_id FROM activation WHERE tenant_id = $1 AND user_id = $2",
            tenant_id,
            user_iri,
        )
        assert [a["milestone_id"] for a in activations] == ["m-1"]

    # The user can still read their (new) sandbox.
    read_response = await client.post(
        "/api/sparql",
        json={
            "query": "SELECT (COUNT(*) AS ?c) WHERE { GRAPH ?g { ?s ?p ?o } }",
            "workspace_id": new_workspace_id,
        },
        headers=headers,
    )
    assert read_response.status_code == 200


# --- AC-005-04: induced failure at the green-build step leaves pointer old -------


async def test_reset_build_failure_leaves_pointer_on_old_workspace(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("onb-reset-build-fail")
    user_sub = "u-reset-build-fail"
    headers = await _login(client, sub=user_sub, tenant_id=tenant_id)
    user_iri = human_principal_iri(user_sub)

    fork = await client.post("/api/onboarding/sandbox", headers=headers)
    old_workspace_id = fork.json()["workspace_id"]

    bad_op = AddNodeOp(op="add_node", ref="bad-1", kind="NotARealKind", label="Bad")
    bad_artefact = CompiledArtefact(semver="0.0.1-bad", batches=[[bad_op]])

    with patch("weave_backend.routers.onboarding._seed_artefact", return_value=bad_artefact):
        failed = await client.post("/api/onboarding/sandbox/reset", headers=headers)
    assert failed.status_code == 502

    async with tenant_connection(tenant_id) as conn:
        state = await conn.fetchrow(
            "SELECT sandbox_workspace_id FROM onboarding_state WHERE tenant_id = $1"
            " AND user_id = $2",
            tenant_id,
            user_iri,
        )
        assert str(state["sandbox_workspace_id"]) == old_workspace_id


# --- AC-005-04: induced failure at the publish step also leaves pointer old ------


async def test_reset_publish_failure_leaves_pointer_on_old_workspace(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("onb-reset-pub-fail")
    user_sub = "u-reset-pub-fail"
    headers = await _login(client, sub=user_sub, tenant_id=tenant_id)
    user_iri = human_principal_iri(user_sub)

    fork = await client.post("/api/onboarding/sandbox", headers=headers)
    old_workspace_id = fork.json()["workspace_id"]

    with patch(
        "weave_backend.onboarding.sandbox.publish_version",
        new=AsyncMock(return_value=None),
    ):
        failed = await client.post("/api/onboarding/sandbox/reset", headers=headers)
    assert failed.status_code == 502

    async with tenant_connection(tenant_id) as conn:
        state = await conn.fetchrow(
            "SELECT sandbox_workspace_id FROM onboarding_state WHERE tenant_id = $1"
            " AND user_id = $2",
            tenant_id,
            user_iri,
        )
        assert str(state["sandbox_workspace_id"]) == old_workspace_id


# --- AC-005-06: old-workspace delete failure is a logged orphan, not a reset failure --


async def test_reset_old_workspace_delete_failure_is_orphaned_not_fatal(
    client: AsyncClient, platform_stack: Path
) -> None:
    """The old sandbox always carries a `workspace_members` row (granted on
    fork), so its delete always hits the FK RESTRICT -- exercising AC-005-06
    for real, not via a mock.
    """
    tenant_id = _unique_tenant("onb-reset-orphan")
    headers = await _login(client, sub="u-reset-orphan", tenant_id=tenant_id)

    fork = await client.post("/api/onboarding/sandbox", headers=headers)
    old_workspace_id = fork.json()["workspace_id"]

    reset = await client.post("/api/onboarding/sandbox/reset", headers=headers)
    assert reset.status_code == 200
    body = reset.json()
    assert body["orphaned_workspace_id"] == old_workspace_id
    assert body["workspace_id"] != old_workspace_id

    async with tenant_connection(tenant_id) as conn:
        still_there = await conn.fetchrow(
            "SELECT id FROM workspaces WHERE tenant_id = $1 AND id = $2",
            tenant_id,
            old_workspace_id,
        )
    assert still_there is not None


# --- edge case: two concurrent resets never leave a mixed/partial pointer --------


async def test_concurrent_resets_leave_pointer_consistent_not_partial(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Two overlapping reset requests race on the same user's pointer. Each
    swap is its own short transaction (no long-held lock across the whole
    reset), so both may succeed -- but AC-005-04's invariant must still hold:
    the final pointer is a real, fully-built workspace (never null, never a
    half-forked one), and exercises stay cleared. This is the concurrency
    analogue of the induced-failure tests above.
    """
    tenant_id = _unique_tenant("onb-reset-concurrent")
    user_sub = "u-reset-concurrent"
    headers = await _login(client, sub=user_sub, tenant_id=tenant_id)
    user_iri = human_principal_iri(user_sub)

    fork = await client.post("/api/onboarding/sandbox", headers=headers)
    assert fork.status_code == 200

    responses = await asyncio.gather(
        client.post("/api/onboarding/sandbox/reset", headers=headers),
        client.post("/api/onboarding/sandbox/reset", headers=headers),
    )
    assert {r.status_code for r in responses} <= {200}
    final_workspace_ids = {r.json()["workspace_id"] for r in responses}

    async with tenant_connection(tenant_id) as conn:
        state = await conn.fetchrow(
            "SELECT sandbox_workspace_id FROM onboarding_state WHERE tenant_id = $1"
            " AND user_id = $2",
            tenant_id,
            user_iri,
        )
        pointer = str(state["sandbox_workspace_id"])
        # The pointer must land on one of the two racing resets' own
        # freshly-built workspace -- never null, never a third/foreign value.
        assert pointer in final_workspace_ids

        workspace_row = await conn.fetchrow(
            "SELECT id FROM workspaces WHERE tenant_id = $1 AND id = $2", tenant_id, pointer
        )
        assert workspace_row is not None

        exercises = await conn.fetch(
            "SELECT exercise_id FROM exercise_completion WHERE tenant_id = $1 AND user_id = $2",
            tenant_id,
            user_iri,
        )
        assert exercises == []

    read_response = await client.post(
        "/api/sparql",
        json={
            "query": "SELECT (COUNT(*) AS ?c) WHERE { GRAPH ?g { ?s ?p ?o } }",
            "workspace_id": pointer,
        },
        headers=headers,
    )
    assert read_response.status_code == 200
