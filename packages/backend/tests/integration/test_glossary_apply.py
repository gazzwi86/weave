"""CE-V1-TASK-001 integration tests: SKOS glossary term backend (punned
class+concept model, decision B1) against real Oxigraph + Postgres + Redis
stack.

Exercises the whole CE-WRITE-1 -> SHACL gate -> CE-READ-1 loop through
generic primitives only (add_node punning/lang-literal/list-value support in
`graph_ops.py`, `GlossaryTermShape`, `GET /api/ontology/resource/{iri}`) --
there is no glossary-specific write or read endpoint (FR-003).
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
from weave_backend.operations.provenance import prov_graph_iri
from weave_backend.rdf.oxigraph_client import clear_graph, fetch_graph_turtle
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import Workspace, create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

SKOS_CONCEPT = "http://www.w3.org/2004/02/skos/core#Concept"
OWL_CLASS = "http://www.w3.org/2002/07/owl#Class"
SKOS_PREF_LABEL = "http://www.w3.org/2004/02/skos/core#prefLabel"
SKOS_DEFINITION = "http://www.w3.org/2004/02/skos/core#definition"
RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"


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


async def _setup_member(client: AsyncClient, *, label: str) -> tuple[Workspace, dict[str, str]]:
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label="glossary")
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="author@example.invalid",
            role="author",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email="author@example.invalid", user_sub="u-author"
        )
    tokens = await issue_token_pair(sub="u-author", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch_response = await client.post(f"/api/workspaces/{workspace.id}/switch", headers=headers)
    assert switch_response.status_code == 200
    return workspace, headers


def _term_op(
    *,
    ref: str = "t1",
    pref_labels: list[dict[str, str]] | None = None,
    definitions: list[str] | str = "A bill for goods or services rendered.",
) -> dict[str, object]:
    """One `add_node` op building a punned glossary term (decision B1) --
    `additional_types` for the `owl:Class` pun, `{value, lang}` markers for
    `skos:prefLabel`, plain string(s) for `skos:definition` (AC-001-01/-02).
    """
    if pref_labels is None:
        pref_labels = [{"value": "Invoice", "lang": "en"}]
    return {
        "op": "add_node",
        "ref": ref,
        "kind": SKOS_CONCEPT,
        "label": "Invoice",
        "additional_types": [OWL_CLASS],
        "properties": {
            SKOS_PREF_LABEL: pref_labels,
            SKOS_DEFINITION: definitions,
        },
    }


async def test_creating_a_glossary_term_reconciles_owl_and_skos_facets_via_one_resource_iri(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-01/-05: the minted term IRI carries both `rdf:type owl:Class`
    and `rdf:type skos:Concept`, and `GET /api/ontology/resource/{iri}` --
    CE-READ-1's existing generic browse endpoint, TASK-005's pattern, no
    glossary-specific read path -- answers both the OWL-axiom and
    SKOS-annotation facets from that one URI.
    """
    workspace, headers = await _setup_member(client, label="glossary-create")

    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": [_term_op()], "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert response.status_code == 201
        body = response.json()
        term_iri = body["ref_map"]["t1"]

        resource_response = await client.get(
            f"/api/ontology/resource/{term_iri}",
            params={"version": body["version_iri"]},
            headers=headers,
        )

        assert resource_response.status_code == 200
        triples = resource_response.json()["triples"]
        types = {t["object"] for t in triples if t["predicate"] == RDF_TYPE}
        predicates = {t["predicate"] for t in triples}
        assert {SKOS_CONCEPT, OWL_CLASS} <= types
        assert {SKOS_PREF_LABEL, SKOS_DEFINITION} <= predicates
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_duplicate_preflabel_language_returns_422_naming_the_colliding_language(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-03: two `skos:prefLabel@en` values on the same draft term is a
    422 whose violation message names `en` (`shacl.py`'s enrichment).
    """
    workspace, headers = await _setup_member(client, label="glossary-dup-lang")

    try:
        op = _term_op(
            pref_labels=[
                {"value": "Invoice", "lang": "en"},
                {"value": "Bill", "lang": "en"},
            ]
        )

        response = await client.post(
            "/api/operations/apply",
            json={"operations": [op], "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )

        assert response.status_code == 422
        violations = response.json()["violations"]
        pref_label_violations = [v for v in violations if v["path"] == SKOS_PREF_LABEL]
        assert pref_label_violations
        assert any("en" in v["message"] for v in pref_label_violations)
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_second_definition_returns_422(client: AsyncClient, platform_stack: Path) -> None:
    """AC-001-02: `skos:definition` is `maxCount 1` -- a second value on the
    same draft term is a 422 naming that field.
    """
    workspace, headers = await _setup_member(client, label="glossary-dup-def")

    try:
        op = _term_op(definitions=["A bill for goods rendered.", "An invoice, informally."])

        response = await client.post(
            "/api/operations/apply",
            json={"operations": [op], "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )

        assert response.status_code == 422
        violations = response.json()["violations"]
        assert any(v["path"] == SKOS_DEFINITION for v in violations)
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_glossary_term_commit_stamps_a_prov_o_activity(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-06: a term mutation is stamped exactly like any other
    CE-WRITE-1 commit -- no glossary-specific provenance path.
    """
    workspace, headers = await _setup_member(client, label="glossary-prov")

    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": [_term_op()], "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert response.status_code == 201
        activity_iri = response.json()["activity_iri"]
        assert activity_iri

        prov_turtle = await fetch_graph_turtle(prov_graph_iri(workspace.named_graph_iri))
        assert activity_iri in prov_turtle
    finally:
        await clear_graph(workspace.named_graph_iri)
