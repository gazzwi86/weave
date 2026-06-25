"""Tests for the OntologyStore façade."""

from __future__ import annotations

from app.ontology import OntologyStore


def _labels(items):
    return {i["label"] for i in items}


def test_seed_projection_has_nodes_and_edges(store: OntologyStore):
    graph = store.graph()
    assert "Scare Floor System" in _labels(graph["nodes"])
    assert any(e["type"] == "dependsOn" for e in graph["edges"])
    scare_floor = next(n for n in graph["nodes"] if n["label"] == "Scare Floor System")
    assert scare_floor["kind"] == "System"
    assert scare_floor["color"].startswith("#")


def test_add_and_update_node():
    store = OntologyStore(seed=False)
    node_id = store.add_node({"label": "Payments", "kind": "Service", "comment": "Takes money"})
    node = next(n for n in store.graph()["nodes"] if n["id"] == node_id)
    assert node["label"] == "Payments" and node["kind"] == "Service"
    assert node["comment"] == "Takes money"

    store.update_node(node_id, {"label": "Payments Service", "comment": "Updated"})
    node = next(n for n in store.graph()["nodes"] if n["id"] == node_id)
    assert node["label"] == "Payments Service" and node["comment"] == "Updated"


def test_add_edge_with_annotation():
    store = OntologyStore(seed=False)
    a = store.add_node({"label": "A", "kind": "Service"})
    b = store.add_node({"label": "B", "kind": "Service"})
    store.add_edge({"source": a, "target": b, "type": "dependsOn", "comment": "tight coupling"})
    edge = next(e for e in store.graph()["edges"] if e["source"] == a and e["target"] == b)
    assert edge["type"] == "dependsOn"
    assert edge["label"] == "depends on"
    assert edge["comment"] == "tight coupling"


def test_delete_node_removes_incident_edges():
    store = OntologyStore(seed=False)
    a = store.add_node({"label": "A", "kind": "Service"})
    b = store.add_node({"label": "B", "kind": "Service"})
    store.add_edge({"source": a, "target": b, "type": "dependsOn"})
    store.delete_node(b)
    graph = store.graph()
    assert all(n["id"] != b for n in graph["nodes"])
    assert all(e["target"] != b for e in graph["edges"])


def test_update_node_changes_kind():
    store = OntologyStore(seed=False)
    nid = store.add_node({"label": "Thing", "kind": "Concept"})
    store.update_node(nid, {"kind": "System"})
    node = next(n for n in store.graph()["nodes"] if n["id"] == nid)
    assert node["kind"] == "System"


def test_partial_update_preserves_unspecified_fields():
    store = OntologyStore(seed=False)
    nid = store.add_node(
        {"label": "Box", "kind": "System", "color": "#abcdef", "x": 12.0, "y": 34.0}
    )
    store.update_node(nid, {"comment": "now described"})
    node = next(n for n in store.graph()["nodes"] if n["id"] == nid)
    assert node["comment"] == "now described"
    assert node["color"] == "#abcdef"
    assert node["x"] == 12.0 and node["y"] == 34.0
    assert node["kind"] == "System"


def test_unknown_relationship_type_rejected():
    store = OntologyStore(seed=False)
    a = store.add_node({"label": "A"})
    b = store.add_node({"label": "B"})
    try:
        store.add_edge({"source": a, "target": b, "type": "nonsense"})
    except ValueError:
        return
    raise AssertionError("expected ValueError for unknown relationship type")


def test_turtle_roundtrip(store: OntologyStore):
    ttl = store.export_turtle()
    assert "weave:" in ttl or "https://weave.dev/ontology#" in ttl
    other = OntologyStore(seed=False)
    other.import_turtle(ttl)
    assert _labels(other.graph()["nodes"]) == _labels(store.graph()["nodes"])


def test_glossary_and_inventory(store: OntologyStore):
    glossary = store.glossary()
    assert "Scream" in {t["label"] for t in glossary}
    inventory = store.inventory()
    labels = {i["label"] for i in inventory}
    assert {"Scare Floor System", "Energy Dispatch Service"} <= labels
    dispatch = next(i for i in inventory if i["label"] == "Energy Dispatch Service")
    assert "Canister Inventory Service" in dispatch["depends_on"]


# --- sparql_select ------------------------------------------------------------


def test_sparql_select_returns_tabular_results():
    store = OntologyStore(seed=False)
    store.add_node({"label": "Alpha", "kind": "Service"})
    from app import namespaces as ns

    result = store.sparql_select(
        ns.SPARQL_PREFIXES + "\nSELECT ?s ?label WHERE { ?s rdfs:label ?label }"
    )
    # Pyoxigraph returns variable names with a leading '?'.
    assert result["columns"] == ["?s", "?label"]
    assert len(result["rows"]) == 1
    assert result["rows"][0]["?label"] == "Alpha"


def test_sparql_select_rejects_non_select():
    store = OntologyStore(seed=False)
    try:
        store.sparql_select("INSERT DATA { <urn:x> <urn:p> <urn:o> }")
    except ValueError as exc:
        assert "SELECT" in str(exc)
        return
    raise AssertionError("expected ValueError for non-SELECT query")


def test_sparql_select_rejects_service_query():
    store = OntologyStore(seed=False)
    try:
        store.sparql_select(
            "SELECT ?s WHERE { SERVICE <http://example.com/sparql> { ?s ?p ?o } }"
        )
    except ValueError as exc:
        assert "SERVICE" in str(exc)
        return
    raise AssertionError("expected ValueError for SERVICE query")


def test_sparql_select_caps_at_500_rows():
    """A cartesian product that would return thousands of rows must be capped at 500."""
    store = OntologyStore(seed=True)  # demo data gives enough triples
    result = store.sparql_select(
        "SELECT ?s1 ?s2 WHERE { ?s1 ?p1 ?o1 . ?s2 ?p2 ?o2 }"
    )
    assert len(result["rows"]) == 500
