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
    monkeypatch.setattr(governance_shapes, "run_update", AsyncMock())
    prov_append_spy = AsyncMock()
    monkeypatch.setattr(provenance, "append_graph", prov_append_spy)
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


# G2 (remediation-2-api-gaps.md): commit_tenant_shape must retract the
# incoming shape IRI's existing triple closure (itself + reachable blank
# nodes) before appending the new version -- re-committing the same shape
# IRI must never stack duplicate/conflicting constraint triples. Retract
# is a surgical per-subject SPARQL Update (oxigraph_client.run_update),
# never a whole-graph load_graph replace (would race other tenants'
# concurrent shape edits) -- see ADR-028.


async def test_commit_tenant_shape_retracts_existing_subject_before_appending(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    append_spy = AsyncMock()
    monkeypatch.setattr(governance_shapes, "append_graph", append_spy)
    update_spy = AsyncMock()
    monkeypatch.setattr(governance_shapes, "run_update", update_spy)
    monkeypatch.setattr(provenance, "append_graph", AsyncMock())
    monkeypatch.setattr(governance_shapes, "enqueue", AsyncMock())
    redis = FakeRedis()
    conn = object()

    await governance_shapes.commit_tenant_shape(
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

    update_spy.assert_called_once()
    retract_query = update_spy.call_args.args[0]
    assert GENERATED_IRI in retract_query
    assert shacl.tenant_shapes_graph_iri(TENANT_ID) in retract_query
    # Retract must run before the new triples are appended -- otherwise the
    # retract would delete the version it just wrote.
    assert update_spy.call_args_list[0] is update_spy.call_args
    append_spy.assert_called_once()


async def test_commit_tenant_shape_rejects_shape_iri_with_sparql_breakout_chars(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Defence in depth: `shape_iri` is embedded in a hand-built SPARQL
    Update string -- reject anything that could break out of an IRIREF
    (`<...>`) before it ever reaches the query text."""
    monkeypatch.setattr(governance_shapes, "append_graph", AsyncMock())
    monkeypatch.setattr(governance_shapes, "run_update", AsyncMock())
    monkeypatch.setattr(provenance, "append_graph", AsyncMock())
    monkeypatch.setattr(governance_shapes, "enqueue", AsyncMock())
    malicious_iri = f"{GENERATED_IRI}> }} }} DELETE {{ ?s ?p ?o"

    with pytest.raises(ValueError):
        await governance_shapes.commit_tenant_shape(
            object(),
            FakeRedis(),
            governance_shapes.ShapeCommit(
                tenant_id=TENANT_ID,
                approver_iri=APPROVER_IRI,
                shape_graph=_one_property_shape(),
                shape_iri=malicious_iri,
                ai_generated=False,
            ),
        )


# G3 (remediation-2-api-gaps.md): retire_tenant_shape -- the shared
# blank-node-closure retract, reused from G2, with no re-append. Framework
# shapes are immutable (403 at the router); an unknown tenant shape 404s.


async def test_retire_tenant_shape_retracts_bumps_version_and_audits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update_spy = AsyncMock()
    monkeypatch.setattr(governance_shapes, "run_update", update_spy)
    existing_ntriples = _one_property_shape().serialize(format="nt")
    monkeypatch.setattr(
        governance_shapes, "fetch_graph_ntriples", AsyncMock(return_value=existing_ntriples)
    )
    enqueue_spy = AsyncMock()
    monkeypatch.setattr(governance_shapes, "enqueue", enqueue_spy)
    redis = FakeRedis()
    conn = object()

    await governance_shapes.retire_tenant_shape(
        conn,
        redis,
        tenant_id=TENANT_ID,
        approver_iri=APPROVER_IRI,
        shape_iri=GENERATED_IRI,
    )

    update_spy.assert_called_once()
    assert GENERATED_IRI in update_spy.call_args.args[0]
    enqueue_spy.assert_called_once()
    event = enqueue_spy.call_args.args[1]
    assert event.event_type == "governance.shape_retired"
    assert event.subject_iri == GENERATED_IRI
    assert await redis.get(f"ce:governance:shapes-version:{TENANT_ID}") is not None


async def test_retire_tenant_shape_raises_not_found_for_unknown_shape(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(governance_shapes, "run_update", AsyncMock())
    monkeypatch.setattr(governance_shapes, "fetch_graph_ntriples", AsyncMock(return_value=""))
    monkeypatch.setattr(governance_shapes, "enqueue", AsyncMock())

    with pytest.raises(governance_shapes.ShapeNotFoundError):
        await governance_shapes.retire_tenant_shape(
            object(),
            FakeRedis(),
            tenant_id=TENANT_ID,
            approver_iri=APPROVER_IRI,
            shape_iri=GENERATED_IRI,
        )


async def test_retire_tenant_shape_raises_forbidden_for_framework_shape() -> None:
    framework_iri = str(next(iter(shacl.framework_shape_iris())))

    with pytest.raises(governance_shapes.FrameworkShapeImmutableError):
        await governance_shapes.retire_tenant_shape(
            object(),
            FakeRedis(),
            tenant_id=TENANT_ID,
            approver_iri=APPROVER_IRI,
            shape_iri=framework_iri,
        )
