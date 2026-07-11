"""CE-V1-TASK-003 (EPIC-004) integration tests: Brand & Voice Model, real
HTTP surface -- the write path (CE-WRITE-1, `POST /api/operations/apply`)
and the two CE-BRAND-1 read projections (`GET /api/brand/tokens`,
`GET /api/brand/voice-rules`), against a real Oxigraph + Postgres + Redis
stack.

AC-003-01 must be proven end-to-end via the REAL write API, not the
`operations/graph_ops.py` unit tests alone (those call `apply_operations`
directly, bypassing the pipeline/BPMO-kind-guard/SHACL layers this router
wraps around it) -- see `test_effective_date_string_coerces_to_xsd_date...`
below.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from rdflib import XSD, Graph, Literal, URIRef

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.rdf.oxigraph_client import clear_graph, fetch_graph_turtle
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import Workspace, create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

BRAND_STANDARD = "https://weave.io/ontology/BrandStandard"
VOICE_RULE = "https://weave.io/ontology/VoiceRule"


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
        return await create_workspace(conn, tenant_id=tenant_id, slug=label, display_name=label)


async def _authed_client(
    client: AsyncClient, *, tenant_id: str, user_sub: str, workspace_id: str
) -> dict[str, str]:
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch_response = await client.post(f"/api/workspaces/{workspace_id}/switch", headers=headers)
    assert switch_response.status_code == 200
    return headers


async def _setup_admin(client: AsyncClient, *, label: str) -> tuple[str, Workspace, dict[str, str]]:
    """admin (rank 3) clears every RBAC bar this file needs: write (author),
    publish (publish), and read -- one role, fewer fixtures.
    """
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label="brand")
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="u-1@example.invalid",
            role="admin",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email="u-1@example.invalid", user_sub="u-1"
        )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-1", workspace_id=workspace.id
    )
    return tenant_id, workspace, headers


def _brand_standard_op(
    *,
    ref: str = "b1",
    label: str = "Primary colour token",
    effective_date: str = "2026-01-01",
    content_type: str = "color",
    content_body: str = '{"primary": "#111827"}',
) -> dict[str, object]:
    # label+kind is a dedup key (`find_existing_by_label_kind`, CE-TASK-001)
    # -- two BrandStandard ops in the same batch need distinct labels or the
    # second silently merges into the first instead of minting its own node.
    return {
        "op": "add_node",
        "ref": ref,
        "kind": BRAND_STANDARD,
        "label": label,
        "properties": {
            "contentType": content_type,
            "effectiveDate": effective_date,
            "owner": "design-team",
            "contentBody": content_body,
        },
    }


def _voice_rule_op(
    *, ref: str = "v1", assertion: str | None = "no second-person imperative"
) -> dict[str, object]:
    properties = {"ruleId": "vr-1", "severity": "critical"}
    if assertion is not None:
        properties["assertion"] = assertion
    return {
        "op": "add_node",
        "ref": ref,
        "kind": VOICE_RULE,
        "label": "No commands",
        "properties": properties,
    }


async def test_effective_date_string_coerces_to_xsd_date_and_commits(
    client: AsyncClient,
) -> None:
    """AC-003-01, real write path: a `weave:effectiveDate` string committed
    through the JSON write API produces an `xsd:date` literal that PASSES
    SHACL (201, not the old xsd:string 422 Violation).
    """
    _tenant_id, workspace, headers = await _setup_admin(client, label="brand-date")
    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": [_brand_standard_op()], "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )

        assert response.status_code == 201
        body = response.json()
        assert body["applied_count"] == 1
        subject_iri = body["ref_map"]["b1"]

        turtle = await fetch_graph_turtle(workspace.named_graph_iri)
        graph = Graph()
        graph.parse(data=turtle, format="turtle")
        literal = graph.value(
            URIRef(subject_iri), URIRef("https://weave.io/ontology/effectiveDate")
        )
        assert isinstance(literal, Literal)
        assert literal.datatype == XSD.date
        assert str(literal) == "2026-01-01"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_malformed_effective_date_returns_400_not_500(client: AsyncClient) -> None:
    """Blast radius (XT-CE003-1): a malformed date fails cleanly through the
    real write API, not a 500.
    """
    _tenant_id, workspace, headers = await _setup_admin(client, label="brand-bad-date")
    try:
        response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [_brand_standard_op(effective_date="not-a-date")],
                "actor": "urn:weave:principal:test-actor",
            },
            headers=headers,
        )

        assert response.status_code == 400
        assert response.json()["detail"] == {"error": "invalid_literal_value"}

        # And the working graph was never touched by the rejected mutation.
        turtle = await fetch_graph_turtle(workspace.named_graph_iri)
        assert "effectiveDate" not in turtle
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_brand_standard_missing_owner_returns_422(client: AsyncClient) -> None:
    """AC-003-02: a required BrandStandard property missing trips
    `weave:BrandStandardShape`'s Violation, same as any other kind.
    """
    _tenant_id, workspace, headers = await _setup_admin(client, label="brand-missing-owner")
    try:
        op = _brand_standard_op()
        properties = op["properties"]
        assert isinstance(properties, dict)
        del properties["owner"]

        response = await client.post(
            "/api/operations/apply",
            json={"operations": [op], "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )

        assert response.status_code == 422
        assert response.json()["violations"]
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_voice_rule_without_assertion_returns_422(client: AsyncClient) -> None:
    """AC-003-05: a human label alone (no machine-evaluable `assertion`) is
    not a valid VoiceRule.
    """
    _tenant_id, workspace, headers = await _setup_admin(client, label="brand-no-assertion")
    try:
        response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [_voice_rule_op(assertion=None)],
                "actor": "urn:weave:principal:test-actor",
            },
            headers=headers,
        )

        assert response.status_code == 422
        assert response.json()["violations"]
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_brand_tokens_and_voice_rules_reflect_a_published_commit(
    client: AsyncClient,
) -> None:
    """AC-003-03/-04/-06 (CE-BRAND-1 contract): once published, the two
    projection endpoints return flat, closed-core + extensions JSON derived
    from the committed individuals -- no RDF parsing required by a consumer.
    """
    _tenant_id, workspace, headers = await _setup_admin(client, label="brand-tokens")
    try:
        apply_response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    _brand_standard_op(
                        ref="b1",
                        label="Primary colour token",
                        content_type="color",
                        content_body='{"primary": "#111827"}',
                    ),
                    _brand_standard_op(
                        ref="b2",
                        label="Base motion duration",
                        content_type="motion",
                        content_body='{"duration": "200ms"}',
                    ),
                    _voice_rule_op(),
                ],
                "actor": "urn:weave:principal:test-actor",
            },
            headers=headers,
        )
        assert apply_response.status_code == 201
        version_iri = apply_response.json()["version_iri"]

        publish_response = await client.post(
            f"/api/ontology/versions/{version_iri}/publish", headers=headers
        )
        assert publish_response.status_code == 200

        tokens_response = await client.get(
            "/api/brand/tokens", params={"version": version_iri}, headers=headers
        )
        assert tokens_response.status_code == 200
        tokens = tokens_response.json()
        assert tokens["color"] == {"primary": "#111827"}
        assert tokens["typography"] == {}
        assert tokens["spacing"] == {}
        assert tokens["radius"] == {}
        assert tokens["extensions"] == {"motion": {"duration": "200ms"}}

        voice_rules_response = await client.get(
            "/api/brand/voice-rules", params={"version": version_iri}, headers=headers
        )
        assert voice_rules_response.status_code == 200
        assert voice_rules_response.json() == [
            {
                "id": "vr-1",
                "severity": "critical",
                "assertion": "no second-person imperative",
            }
        ]
    finally:
        await clear_graph(workspace.named_graph_iri)


@pytest.mark.parametrize("path", ["/api/brand/tokens", "/api/brand/voice-rules"])
async def test_brand_endpoint_401s_with_no_bearer_token(client: AsyncClient, path: str) -> None:
    """AC-003-07."""
    response = await client.get(path)
    assert response.status_code == 401


@pytest.mark.parametrize("path", ["/api/brand/tokens", "/api/brand/voice-rules"])
async def test_brand_endpoint_404s_on_an_unknown_version(client: AsyncClient, path: str) -> None:
    """AC-003-07."""
    _tenant_id, workspace, headers = await _setup_admin(client, label="brand-404")
    try:
        response = await client.get(
            path,
            params={"version": f"{workspace.named_graph_iri}:v999"},
            headers=headers,
        )
        assert response.status_code == 404
    finally:
        await clear_graph(workspace.named_graph_iri)
