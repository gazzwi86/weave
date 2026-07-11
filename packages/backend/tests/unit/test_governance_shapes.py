"""CE-TASK-005 unit tests: `commit_tenant_shape` -- the sole writer to a
tenant's governance shapes graph (ADR-024) -- and its PROV-O helper
`write_shape_activity` (AC-005-01/-02).

Mocks the Oxigraph HTTP boundary (`append_graph`) and the audit outbox
directly -- no docker -- same convention as `test_operations_provenance.py`.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from rdflib import RDF, Graph, URIRef
from rdflib.namespace import PROV

from weave_backend.operations import governance_shapes, provenance, shacl

TENANT_ID = "t1"
APPROVER_IRI = "urn:weave:principal:user:u-real"
GENERATED_IRI = "https://weave.io/instances/shape-abc123"


class FakeRedis:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def set(self, key: str, value: str, *, nx: bool = False, ex: int | None = None) -> bool:
        self._store[key] = value
        return True

    async def get(self, key: str) -> str | None:
        return self._store.get(key)


def _one_property_shape() -> Graph:
    graph = Graph()
    graph.parse(
        data=f"""
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix weave: <https://weave.io/ontology/> .

        <{GENERATED_IRI}> a sh:NodeShape ;
            sh:targetClass weave:Process ;
            sh:property [ sh:path weave:performedBy ; sh:minCount 1 ] .
        """,
        format="turtle",
    )
    return graph


async def test_write_shape_activity_records_approver_only_when_self_authored(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    append_spy = AsyncMock()
    monkeypatch.setattr(provenance, "append_graph", append_spy)

    activity_iri = await provenance.write_shape_activity(
        shapes_graph_iri=shacl.tenant_shapes_graph_iri(TENANT_ID),
        approver_iri=APPROVER_IRI,
        generator_iri=None,
        generated_iri=GENERATED_IRI,
    )

    turtle = append_spy.call_args.args[1]
    graph = Graph()
    graph.parse(data=turtle, format="turtle")
    activity = URIRef(activity_iri)

    assert (activity, PROV.wasAssociatedWith, URIRef(APPROVER_IRI)) in graph
    assert (activity, PROV.wasStartedBy, URIRef(APPROVER_IRI)) in graph
    assert (activity, PROV.generated, URIRef(GENERATED_IRI)) in graph
    assert len(list(graph.objects(activity, PROV.qualifiedAssociation))) == 0


async def test_write_shape_activity_records_llm_generator_and_human_approver(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-005-01: PROV-O attributes the LLM as generator, the human as
    approver -- both present, distinguishable by role.
    """
    append_spy = AsyncMock()
    monkeypatch.setattr(provenance, "append_graph", append_spy)
    generator_iri = "https://weave.io/instances/agent-claude-sonnet-5"

    activity_iri = await provenance.write_shape_activity(
        shapes_graph_iri=shacl.tenant_shapes_graph_iri(TENANT_ID),
        approver_iri=APPROVER_IRI,
        generator_iri=generator_iri,
        generated_iri=GENERATED_IRI,
    )

    turtle = append_spy.call_args.args[1]
    graph = Graph()
    graph.parse(data=turtle, format="turtle")
    activity = URIRef(activity_iri)

    assert (URIRef(generator_iri), RDF.type, PROV.SoftwareAgent) in graph
    assert (URIRef(APPROVER_IRI), RDF.type, PROV.Person) in graph
    assert (activity, PROV.wasAssociatedWith, URIRef(generator_iri)) in graph
    assert (activity, PROV.wasAssociatedWith, URIRef(APPROVER_IRI)) in graph
    assert (activity, PROV.wasStartedBy, URIRef(APPROVER_IRI)) in graph
    roles = {
        str(role)
        for assoc in graph.objects(activity, PROV.qualifiedAssociation)
        for role in graph.objects(assoc, PROV.hadRole)
    }
    assert roles == {"https://weave.io/ontology/generator"}


async def test_commit_tenant_shape_appends_bumps_version_and_audits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    append_spy = AsyncMock()
    monkeypatch.setattr(governance_shapes, "append_graph", append_spy)
    enqueue_spy = AsyncMock()
    monkeypatch.setattr(governance_shapes, "enqueue", enqueue_spy)
    redis = FakeRedis()
    conn = object()

    activity_iri = await governance_shapes.commit_tenant_shape(
        conn,
        redis,
        governance_shapes.ShapeCommit(
            tenant_id=TENANT_ID,
            approver_iri=APPROVER_IRI,
            shape_graph=_one_property_shape(),
            shape_iri=GENERATED_IRI,
            ai_generated=False,
        ),
    )

    append_spy.assert_called_once()
    assert append_spy.call_args.args[0] == shacl.tenant_shapes_graph_iri(TENANT_ID)
    enqueue_spy.assert_called_once()
    event = enqueue_spy.call_args.args[1]
    assert event.event_type == "governance.shape_committed"
    assert event.subject_iri == GENERATED_IRI
    assert await redis.get(f"ce:governance:shapes-version:{TENANT_ID}") is not None
    assert activity_iri
