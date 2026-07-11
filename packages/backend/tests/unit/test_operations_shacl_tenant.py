"""CE-TASK-005 unit tests: tenant-scoped SHACL shapes graph (AC-005-02/-03/
-04).

`validate_graph_for_tenant` must validate against framework-shapes-only when
a tenant has never committed a custom shape, and against framework + that
tenant's own shapes once one exists -- never another tenant's (AC-005-03/
-04, the cross-tenant shape-leak gate). Cache correctness (AC-005-02) is
version-keyed: a stale in-process cache entry must never be served once the
tenant's Redis version token has moved on.
"""

from __future__ import annotations

import asyncio

import pytest
from rdflib import RDF, XSD, Graph, Literal, Namespace

from weave_backend.operations import shacl

WEAVE = Namespace("https://weave.io/ontology/")
SH = Namespace("http://www.w3.org/ns/shacl#")
EX = Namespace("https://weave.io/instances/")


class FakeRedis:
    """Minimal async stand-in -- same subset used across the pipeline test
    suite (`test_operations_idempotency.py`'s `FakeRedis`): `get`/`set`.
    """

    def __init__(self) -> None:
        self._store: dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def set(self, key: str, value: str, *, nx: bool = False, ex: int | None = None) -> bool:
        async with self._lock:
            if nx and key in self._store:
                return False
            self._store[key] = value
            return True

    async def get(self, key: str) -> str | None:
        async with self._lock:
            return self._store.get(key)


def _process_missing_label_graph() -> Graph:
    graph = Graph()
    graph.add((EX.actor1, RDF.type, WEAVE.Actor))
    graph.add((EX.proc1, RDF.type, WEAVE.Process))
    graph.add((EX.proc1, WEAVE.performedBy, EX.actor1))
    return graph


def _tenant_shape_ntriples(target_class: str, path: str, message: str) -> str:
    """A minimal, valid tenant custom shape: `path` is mandatory
    (`sh:minCount 1`) on `target_class`.
    """
    shape = Graph()
    shape_iri = EX["tenant-shape-1"]
    prop_iri = EX["tenant-shape-1-prop"]
    shape.add((shape_iri, RDF.type, SH.NodeShape))
    shape.add((shape_iri, SH.targetClass, WEAVE[target_class]))
    shape.add((shape_iri, SH.property, prop_iri))
    shape.add((prop_iri, SH.path, WEAVE[path]))
    shape.add((prop_iri, SH.minCount, Literal(1)))
    shape.add((prop_iri, SH.severity, SH.Violation))
    shape.add((prop_iri, SH.message, Literal(message, datatype=XSD.string)))
    return shape.serialize(format="nt")


def setup_function() -> None:
    shacl.reset_shapes_cache_for_tests()


def test_tenant_shapes_graph_iri_is_tenant_wide_not_workspace_scoped() -> None:
    # AC-005-01/ADR-023: governance shapes are tenant-wide -- no `:ws:`
    # segment, unlike ADR-001's per-workspace data-graph naming.
    assert shacl.tenant_shapes_graph_iri("t1") == "urn:weave:g:tenant:t1:shapes"


async def test_no_tenant_shapes_committed_yet_validates_framework_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fail_fetch(iri: str) -> str:
        raise AssertionError(f"must not fetch tenant shapes graph when no version key set: {iri}")

    monkeypatch.setattr(shacl, "fetch_graph_ntriples", _fail_fetch)
    redis = FakeRedis()

    results = await shacl.validate_graph_for_tenant(
        _process_missing_label_graph(), tenant_id="t1", redis_client=redis
    )

    violations = [r for r in results if r.severity == "Violation"]
    assert any(str(EX.proc1) == v.focus_node for v in violations)


async def test_automatable_shape_is_enforced_even_without_tenant_shapes() -> None:
    """AC-005-06: `weave:AutomatableShape` is part of the shape set every
    validation runs against -- framework-wide, whether or not the tenant
    has committed any custom shapes of their own (default-absent is fine;
    a non-boolean value, once asserted, is not).
    """
    graph = Graph()
    graph.add((EX.proc1, RDF.type, WEAVE.Process))
    graph.add((EX.proc1, WEAVE.label, Literal("Onboarding", datatype=XSD.string)))
    graph.add((EX.proc1, WEAVE.performedBy, EX.actor1))
    graph.add((EX.actor1, RDF.type, WEAVE.Actor))
    graph.add((EX.proc1, WEAVE.automatable, Literal("yes")))  # not xsd:boolean

    results = await shacl.validate_graph_for_tenant(graph, tenant_id="t1", redis_client=None)

    assert any(r.severity == "Violation" and r.path == str(WEAVE.automatable) for r in results)


async def test_redis_client_none_falls_back_to_framework_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Test-convenience path (`redis_client=None`) exercised by every
    # existing pipeline unit test that doesn't care about tenant shapes.
    results = await shacl.validate_graph_for_tenant(
        _process_missing_label_graph(), tenant_id="t1", redis_client=None
    )
    violations = [r for r in results if r.severity == "Violation"]
    assert any(str(EX.proc1) == v.focus_node for v in violations)


async def test_committed_tenant_shape_is_enforced_on_next_validation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ntriples = _tenant_shape_ntriples("Actor", "email", "Actor must have an email.")
    monkeypatch.setattr(shacl, "fetch_graph_ntriples", lambda iri: _async_return(ntriples))
    redis = FakeRedis()
    await shacl.bump_shapes_version(redis, "t1")

    graph = Graph()
    graph.add((EX.actor1, RDF.type, WEAVE.Actor))
    graph.add((EX.actor1, WEAVE.label, Literal("Ops", datatype=XSD.string)))
    # No weave:email -- must trip the tenant's own shape.

    results = await shacl.validate_graph_for_tenant(graph, tenant_id="t1", redis_client=redis)

    violations = [r for r in results if r.severity == "Violation"]
    assert any(str(EX.actor1) == v.focus_node for v in violations)


async def test_tenant_a_shape_never_leaks_into_tenant_b_validation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-005-03: the cross-tenant shape-leak gate -- tenant A commits a
    shape requiring `weave:email` on Actor; tenant B's identical Actor
    (no email) must still validate clean.
    """
    ntriples = _tenant_shape_ntriples("Actor", "email", "Actor must have an email.")

    async def _fetch(iri: str) -> str:
        assert iri == shacl.tenant_shapes_graph_iri("t-a"), (
            f"tenant B's validation must never fetch tenant A's shapes graph: {iri}"
        )
        return ntriples

    monkeypatch.setattr(shacl, "fetch_graph_ntriples", _fetch)
    redis = FakeRedis()
    await shacl.bump_shapes_version(redis, "t-a")
    # Tenant B has never committed a shape -- no version key for t-b.

    graph = Graph()
    graph.add((EX.actor1, RDF.type, WEAVE.Actor))
    graph.add((EX.actor1, WEAVE.label, Literal("Ops", datatype=XSD.string)))

    results = await shacl.validate_graph_for_tenant(graph, tenant_id="t-b", redis_client=redis)

    violations = [r for r in results if r.severity == "Violation"]
    assert violations == []


async def test_stale_cache_entry_is_not_served_after_version_bump(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-005-02: a shape commit bumps the tenant's version token, enforced
    on the very next validation -- including a shape *edit/deletion*, not
    just an addition (the DoD pitfall note).
    """
    call_count = {"n": 0}

    async def _fetch(iri: str) -> str:
        call_count["n"] += 1
        if call_count["n"] == 1:
            return _tenant_shape_ntriples("Actor", "email", "v1")
        return ""  # v2: tenant deleted their only shape.

    monkeypatch.setattr(shacl, "fetch_graph_ntriples", _fetch)
    redis = FakeRedis()
    await shacl.bump_shapes_version(redis, "t1")

    graph = Graph()
    graph.add((EX.actor1, RDF.type, WEAVE.Actor))
    graph.add((EX.actor1, WEAVE.label, Literal("Ops", datatype=XSD.string)))

    first = await shacl.validate_graph_for_tenant(graph, tenant_id="t1", redis_client=redis)
    assert any(r.severity == "Violation" for r in first)

    await shacl.bump_shapes_version(redis, "t1")
    second = await shacl.validate_graph_for_tenant(graph, tenant_id="t1", redis_client=redis)
    assert not any(r.severity == "Violation" for r in second)
    assert call_count["n"] == 2


async def test_tenant_shapes_for_validation_merges_framework_and_tenant_shapes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """CE-TASK-006: the rule-list enumeration must be built from the exact
    same merged graph `validate_graph_for_tenant` runs against (public
    accessor around the private cache) -- never a second, independently
    fetched copy that could drift."""
    ntriples = _tenant_shape_ntriples("Actor", "email", "Actor must have an email.")
    monkeypatch.setattr(shacl, "fetch_graph_ntriples", lambda iri: _async_return(ntriples))
    redis = FakeRedis()
    await shacl.bump_shapes_version(redis, "t1")

    merged = await shacl.tenant_shapes_for_validation("t1", redis)
    rules = shacl.list_rules(merged, tenant_id="t1")

    by_iri = {r.shape_iri: r for r in rules}
    assert str(WEAVE.ProcessShape) in by_iri
    assert by_iri[str(WEAVE.ProcessShape)].origin == "framework"
    assert str(EX["tenant-shape-1"]) in by_iri
    assert by_iri[str(EX["tenant-shape-1"])].origin == "tenant"


async def _async_return(value: str) -> str:
    return value
