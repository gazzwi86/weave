"""Integration tests for `onboarding/hammerbarn_seed/apply.py` (TASK-002
AC-002-03/-04/-05/-07): applies through the real CE-WRITE-1/CE-VERSION-1
HTTP surface (in-process app, local docker Postgres/Redis/Oxigraph -- Law F,
no real cloud calls), same pattern as `test_glossary_apply.py`.
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
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.onboarding.hammerbarn_seed.apply import (
    SeedApplyHalted,
    apply_seed,
    ask_count,
)
from weave_backend.onboarding.hammerbarn_seed.compile import (
    allowed_kinds_from_ontology_types,
    compile_seed,
)
from weave_backend.schemas.operations import AddNodeOp
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import Workspace, create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

ACTOR = "urn:weave:principal:service:hammerbarn-seed"


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


async def _setup_content_admin(
    client: AsyncClient, *, label: str
) -> tuple[Workspace, dict[str, str]]:
    """Content-admin principal, in-process (ADR-010): a workspace `publish`-
    role member -- CE-WRITE-1 (`operations/apply`) gates on `min_role
    "author"`, rank 1, but CE-VERSION-1 (`versions/{iri}/publish`) gates on
    `min_role "publish"`, rank 2 (`rbac.ROLE_RANK`) -- `apply_seed()`
    publishes the final batch itself, so the one principal needs the
    higher of the two ranks to do both. `role="publish"` (rank 2) is the
    lowest role that clears both gates, so the DoR's "content-admin
    service principal via PLAT-IDENTITY-1" is satisfied by minting a real
    PROV-O principal (this sub) with that role, same as any other
    automated write-back caller.
    """
    tenant_id = _unique_tenant(label)
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="hammerbarn", display_name="Hammerbarn"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="content-admin@example.invalid",
            role="publish",
        )
        await activate_member(
            conn,
            workspace_id=workspace.id,
            email="content-admin@example.invalid",
            user_sub="u-content-admin",
        )
    tokens = await issue_token_pair(sub="u-content-admin", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch_response = await client.post(f"/api/workspaces/{workspace.id}/switch", headers=headers)
    assert switch_response.status_code == 200
    return workspace, headers


async def _compiled_artefact(client: AsyncClient, headers: dict[str, str]):  # type: ignore[no-untyped-def]
    types_response = await client.get("/api/ontology/types", headers=headers)
    types_response.raise_for_status()
    allowed_kinds = allowed_kinds_from_ontology_types(types_response.json())
    return compile_seed(allowed_kinds=allowed_kinds)


async def test_apply_happy_path_publishes_one_version(
    client: AsyncClient, platform_stack: Path
) -> None:
    _workspace, headers = await _setup_content_admin(client, label="hb-happy")
    artefact = await _compiled_artefact(client, headers)

    result = await apply_seed(client, artefact, actor=ACTOR, headers=headers)

    assert result.version_iri
    assert result.applied_count > 0

    versions_response = await client.get("/api/ontology/versions", headers=headers)
    versions_response.raise_for_status()
    versions = versions_response.json()["versions"]
    published = [v for v in versions if v["status"] == "published"]
    assert len(published) == 1
    assert published[0]["version_iri"] == result.version_iri


async def test_apply_rerun_converges_ask_count_unchanged(
    client: AsyncClient, platform_stack: Path
) -> None:
    _workspace, headers = await _setup_content_admin(client, label="hb-converge")
    artefact = await _compiled_artefact(client, headers)

    first = await apply_seed(client, artefact, actor=ACTOR, headers=headers)
    first_count = await ask_count(client, headers=headers)

    # Re-run against a fresh compile of the same content: idempotency keys
    # collide on every batch's cached response, so the graph is unchanged.
    second_artefact = await _compiled_artefact(client, headers)
    with pytest.raises(Exception):  # noqa: B017 -- publish 409s: already published
        await apply_seed(client, second_artefact, actor=ACTOR, headers=headers)

    second_count = await ask_count(client, headers=headers)

    assert second_count == first_count
    assert first.version_iri  # sanity: happy path above covers the value itself


async def test_apply_halts_on_422_and_leaves_published_version_intact(
    client: AsyncClient, platform_stack: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _workspace, headers = await _setup_content_admin(client, label="hb-halt")
    artefact = await _compiled_artefact(client, headers)
    first = await apply_seed(client, artefact, actor=ACTOR, headers=headers)

    # A second artefact whose first batch is a deliberately invalid op: a
    # lone Process node with no `performedBy` edge -- `weave:ProcessShape`
    # requires `performedBy` minCount 1, so CE-WRITE-1's server-side SHACL
    # gate 422s it. (A blank `label` would fail client-side Pydantic
    # validation before any HTTP call, never exercising the intended
    # server-side 422 path.)
    bad_batch = [
        AddNodeOp(op="add_node", ref="bad", kind="Process", label="Bad Process"),
    ]
    from dataclasses import replace

    # Distinct `semver` -- `apply_seed`'s idempotency key is
    # `hammerbarn-seed:{semver}:batch:{index}`; reusing `artefact.semver`
    # here would collide with the real seed's own already-cached batch 0
    # response and silently replay it instead of exercising the bad op.
    bad_artefact = replace(artefact, semver="1.0.0-bad-batch-test", batches=[bad_batch])

    with pytest.raises(SeedApplyHalted):
        await apply_seed(client, bad_artefact, actor=ACTOR, headers=headers)

    versions_response = await client.get("/api/ontology/versions", headers=headers)
    versions_response.raise_for_status()
    versions = versions_response.json()["versions"]
    published = [v for v in versions if v["status"] == "published"]
    assert len(published) == 1
    assert published[0]["version_iri"] == first.version_iri
