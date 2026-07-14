"""ONB-TASK-009 integration tests: POST /api/onboarding/exercises/{id}/check
wired end-to-end -- a passing nav_signal check that persists (and survives a
second call, exercising the upsert/ON CONFLICT branch), a path-gated 403, and
a read-only-locked 403 for a write exercise. Marked `integration`/`docker`
per `test_onboarding_state_api.py`'s precedent.
"""

from __future__ import annotations

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
from weave_backend.onboarding.store import StatePatch, patch_state

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
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


async def _login(client: AsyncClient, *, sub: str, tenant_id: str) -> dict[str, str]:
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    return {"Authorization": f"Bearer {tokens.access_token}"}


async def test_check_passes_and_persists_on_repeat_call(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-009-01/03: a satisfied nav_signal check verifies, persists the
    completion, and is idempotent on a second call (ON CONFLICT UPDATE
    branch), all without ever going near a sandbox graph.
    """
    tenant_id = _unique_tenant("onb-check-pass")
    headers = await _login(client, sub="u-check-pass", tenant_id=tenant_id)
    await client.put(
        "/api/onboarding/path", json={"role_path": "technical"}, headers=headers
    )

    first = await client.post(
        "/api/onboarding/exercises/CE-01/check",
        json={"signals": ["entity-list-viewed", "missing-property-viewed"]},
        headers=headers,
    )
    assert first.status_code == 200
    body = first.json()
    assert body["verified"] is True
    assert body["verified_signal"] == "nav_signal"
    assert body["completed_at"] is not None

    second = await client.post(
        "/api/onboarding/exercises/CE-01/check",
        json={"signals": ["entity-list-viewed", "missing-property-viewed"]},
        headers=headers,
    )
    assert second.status_code == 200
    assert second.json()["verified"] is True

    state = await client.get("/api/onboarding/state", headers=headers)
    completions = {c["exercise_id"] for c in state.json()["exercise_completions"]}
    assert "CE-01" in completions


async def test_check_returns_403_when_path_gated(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-009-06: CE-03 is technical-path-only -- a business-path user is
    403'd server-side, never trusting a client-hidden button.
    """
    tenant_id = _unique_tenant("onb-check-gated")
    headers = await _login(client, sub="u-check-gated", tenant_id=tenant_id)
    await client.put(
        "/api/onboarding/path", json={"role_path": "business"}, headers=headers
    )

    response = await client.post(
        "/api/onboarding/exercises/CE-03/check", json={"signals": []}, headers=headers
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "path_gated"


async def test_check_passes_sparql_ask_against_forked_sandbox(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-009-02/03: a `sparql_ask` completion is checked server-side against
    the caller's own forked sandbox graph (never a client-supplied graph) --
    CE-02 is a write exercise, so it's unmet on a bare fork and only met once
    the "Outdoor Furniture" class the exercise instructs the learner to add
    is actually written into that sandbox via `CE-WRITE-1`.
    """
    tenant_id = _unique_tenant("onb-check-ask")
    user_sub = "u-check-ask"
    headers = await _login(client, sub=user_sub, tenant_id=tenant_id)
    await client.put(
        "/api/onboarding/path", json={"role_path": "business"}, headers=headers
    )
    fork = await client.post("/api/onboarding/sandbox", headers=headers)
    assert fork.status_code == 200
    workspace_id = fork.json()["workspace_id"]

    unmet = await client.post(
        "/api/onboarding/exercises/CE-02/check", json={"signals": []}, headers=headers
    )
    assert unmet.status_code == 200
    assert unmet.json()["verified"] is False

    switch = await client.post(f"/api/workspaces/{workspace_id}/switch", headers=headers)
    assert switch.status_code == 200
    write = await client.post(
        "/api/operations/apply",
        json={
            "operations": [
                {
                    "op": "add_node",
                    "ref": "n-outdoor-furniture",
                    "kind": "Class",
                    "label": "Outdoor Furniture",
                }
            ],
            "actor": f"urn:weave:principal:user:{user_sub}",
            "target": "draft",
        },
        headers=headers,
    )
    assert write.status_code == 201

    response = await client.post(
        "/api/onboarding/exercises/CE-02/check", json={"signals": []}, headers=headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["verified"] is True
    assert body["verified_signal"] == "ask"


async def test_check_returns_403_when_read_only_locked(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-009-06: CE-02 is a write exercise -- a read-only-variant user is
    locked out server-side even though `PUT /path` never sets that variant
    itself (it's role-resolved), so the state is seeded directly.
    """
    tenant_id = _unique_tenant("onb-check-readonly")
    headers = await _login(client, sub="u-check-readonly", tenant_id=tenant_id)
    await client.put(
        "/api/onboarding/path", json={"role_path": "business"}, headers=headers
    )
    async with tenant_connection(tenant_id) as conn:
        await patch_state(
            conn,
            tenant_id=tenant_id,
            user_id=human_principal_iri("u-check-readonly"),
            patch=StatePatch(path_variant="read_only"),
        )

    response = await client.post(
        "/api/onboarding/exercises/CE-02/check", json={"signals": []}, headers=headers
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "read_only_locked"
