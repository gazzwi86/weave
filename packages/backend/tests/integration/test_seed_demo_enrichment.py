"""Runnable check for the demo-seed enrichment (glossary/brand/rules/build
project/audit chain) -- see `db/seed_demo.py`. Same scratch-tenant pattern
as `test_seed_demo.py`, split into its own file so that file stays focused
on the original login/idempotency contract (Law E file-length budget).
"""

from __future__ import annotations

import shutil
import uuid

import pytest

import weave_backend.db.seed_demo as seed_demo
from weave_backend.audit.verify import verify_chain
from weave_backend.briefs.store import epic_refs, list_project_briefs
from weave_backend.build.board import build_board
from weave_backend.build.epics import build_epic_rollup
from weave_backend.build.state_spine import load_state_spine
from weave_backend.db.pool import tenant_connection
from weave_backend.operations.shacl import tenant_shapes_graph_iri
from weave_backend.rdf.oxigraph_client import clear_graph, run_query
from weave_backend.standards.store import list_standards

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


async def _triple_count(graph_iri: str) -> int:
    result = await run_query("SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }", graph_iri)
    return int(result["results"]["bindings"][0]["c"]["value"])


async def _query_rows(query: str, graph_iri: str) -> list[dict[str, dict[str, str]]]:
    result = await run_query(query, graph_iri)
    bindings: list[dict[str, dict[str, str]]] = result["results"]["bindings"]
    return bindings


async def test_seed_demo_enrichment(
    platform_stack: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant_id = f"seed-enrich-{uuid.uuid4().hex[:8]}"
    monkeypatch.setattr(seed_demo, "TENANT_ID", tenant_id)

    try:
        result = await seed_demo.seed()
        assert result["created"] is True
        workspace_id = str(result["workspace_id"])
        named_graph_iri = f"urn:weave:tenant:{tenant_id}:ws:{workspace_id}"

        # Deliverable 1: glossary terms carry skos:definition, and at least
        # one broader/narrower edge exists (RelatedChips reads exactly these
        # two predicates -- see glossary-rows.tsx).
        definitions = await _query_rows(
            "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> "
            "SELECT ?term WHERE { ?term a skos:Concept ; skos:definition ?d . }",
            named_graph_iri,
        )
        assert len(definitions) >= 8

        related = await _query_rows(
            "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> "
            "SELECT ?term WHERE { { ?term skos:broader ?o . } UNION { ?term skos:narrower ?o . } }",
            named_graph_iri,
        )
        assert len(related) >= 2

        # Deliverable 2: brand voice rules + standards land in the same
        # draft graph the Brand & Standards tab reads via POST
        # /api/proxy/sparql (app/ce/brand/queries.ts's standardsQuery/
        # voiceRulesQuery -- effectiveDate/owner are non-OPTIONAL there).
        voice_rules = await _query_rows(
            "PREFIX weave: <https://weave.io/ontology/> "
            "SELECT ?s WHERE { ?s a weave:VoiceRule ; weave:ruleId ?r ; "
            "weave:severity ?sev ; weave:assertion ?a . }",
            named_graph_iri,
        )
        assert len(voice_rules) >= 3

        standards = await _query_rows(
            "PREFIX weave: <https://weave.io/ontology/> "
            "SELECT ?s WHERE { ?s a weave:BrandStandard ; weave:contentType ?ct ; "
            "weave:effectiveDate ?d ; weave:owner ?o . }",
            named_graph_iri,
        )
        assert len(standards) >= 2

        async with tenant_connection(tenant_id) as conn:
            docs = await list_standards(conn, tenant_id=tenant_id, scope="company")
            assert len(docs) >= 2

            # Deliverable 3: tenant SHACL shapes committed via the sole
            # writer (governance_shapes.commit_tenant_shape).
            shapes_graph_iri = tenant_shapes_graph_iri(tenant_id)
            assert await _triple_count(shapes_graph_iri) > 0
            shapes = await _query_rows(
                "PREFIX sh: <http://www.w3.org/ns/shacl#> "
                "SELECT ?s WHERE { ?s a sh:NodeShape . }",
                shapes_graph_iri,
            )
            assert len(shapes) >= 3

            # Deliverable 4: a project, 3 epics' worth of briefs, and a
            # state spine with tasks spread across every kanban lane.
            projects = await conn.fetch(
                "SELECT project_iri FROM projects WHERE tenant_id = $1", tenant_id
            )
            assert len(projects) == 1
            project_iri = str(projects[0]["project_iri"])

            briefs = await list_project_briefs(conn, tenant_id=tenant_id, project_iri=project_iri)
            assert len(briefs) >= 10
            refs = await epic_refs(conn, tenant_id=tenant_id, project_iri=project_iri)

            spine = await load_state_spine(conn, tenant_id=tenant_id, project_iri=project_iri)
            assert spine is not None
            assert len(spine.tasks) >= 10

            rollup = build_epic_rollup(spine, refs)
            assert len(rollup.epics) == 3

            board = build_board(spine)
            lanes_present = {card.lane for card in board.cards}
            assert lanes_present == {"Backlog", "Ready", "Review", "QA", "Done"}

            # Deliverable 6 (A1 investigation): the seed's own audit-outbox
            # traffic (governance.shape_committed x N + the direct
            # seed.demo_workspace_created emit) must flush to a genuinely
            # valid hash chain -- not just the single first entry.
            verify_result = await verify_chain(conn, tenant_id)
            assert verify_result.valid is True
            assert verify_result.entries_checked >= 2
    finally:
        await _cleanup_enrichment(tenant_id)


async def _cleanup_enrichment(tenant_id: str) -> None:
    # ponytail: state_spines/task_briefs/standards_documents have no DELETE
    # grant for weave_app (migrations 0010/0012/0017, same append-mostly
    # posture as graph_versions/audit_entries) -- leftover rows under this
    # test's random tenant_id are harmless and RLS-invisible to every other
    # tenant, same precedent as test_seed_demo.py's `_cleanup`. `projects`
    # does have a DELETE grant (migration 0009), so that one is cleaned up.
    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT id, named_graph_iri FROM workspaces WHERE tenant_id = $1", tenant_id
        )
        for row in rows:
            version_rows = await conn.fetch(
                "SELECT version_iri FROM graph_versions WHERE tenant_id = $1 AND workspace_id = $2",
                tenant_id,
                str(row["id"]),
            )
            for v in version_rows:
                await clear_graph(v["version_iri"])
            await clear_graph(row["named_graph_iri"])
        await clear_graph(tenant_shapes_graph_iri(tenant_id))
        await conn.execute("DELETE FROM projects WHERE tenant_id = $1", tenant_id)
        await conn.execute("DELETE FROM workspace_members WHERE tenant_id = $1", tenant_id)
        await conn.execute("DELETE FROM workspaces WHERE tenant_id = $1", tenant_id)
