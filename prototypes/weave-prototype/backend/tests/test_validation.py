"""Tests for SHACL validation and the gated apply path."""

from __future__ import annotations

from app.validation import schema_rules, validate_turtle


def test_demo_graph_conforms(store):
    assert validate_turtle(store.export_turtle()) == []


def test_validate_catches_wrong_domain_target():
    ttl = """
    @prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix weave: <https://weave.dev/ontology#> .
    @prefix res:   <https://weave.dev/resource/> .
    res:svc a weave:Service ; rdfs:label "A service" .
    res:sys a weave:System ; rdfs:label "A system" ; weave:inDomain res:svc .
    """
    violations = validate_turtle(ttl)
    assert any("Business Domain" in (v["message"] or "") for v in violations)


def test_validate_endpoint_on_demo(client):
    assert client.get("/api/validate").json() == {"violations": []}


def test_schema_rules_derived_from_shapes():
    rules = schema_rules()
    by_rel = {r["relationship"]: r for r in rules}
    # Each SHACL range constraint surfaces as a structured if/then rule.
    assert by_rel["describes"]["object_kind"] == "Concept"
    assert by_rel["describes"]["object_kind_curie"] == "skos:Concept"
    assert by_rel["inDomain"]["object_kind"] == "BusinessDomain"
    assert by_rel["inDomain"]["category"] == "Domain classification"
    assert all(r["severity"] == "Violation" for r in rules)


def test_rules_endpoint(client):
    rules = client.get("/api/rules").json()
    assert any(
        r["relationship"] == "realizes" and r["object_kind"] == "BusinessCapability"
        for r in rules
    )


def test_apply_rejects_batch_that_would_violate_shapes(client):
    ops = [
        {"op": "add_node", "ref": "svc", "label": "FakeDomain", "kind": "Service"},
        {"op": "add_node", "ref": "sys", "label": "Sys", "kind": "System", "domain": "svc"},
    ]
    resp = client.post("/api/operations/apply", json={"operations": ops})
    assert resp.status_code == 422
    assert "Validation failed" in resp.json()["detail"]
    # The real graph must be untouched.
    labels = {n["label"] for n in client.get("/api/graph").json()["nodes"]}
    assert "Sys" not in labels and "FakeDomain" not in labels


def test_apply_allows_valid_batch(client):
    ops = [
        {"op": "add_node", "ref": "d", "label": "Finance", "kind": "BusinessDomain"},
        {"op": "add_node", "ref": "s", "label": "Ledger Svc", "kind": "System", "domain": "d"},
    ]
    resp = client.post("/api/operations/apply", json={"operations": ops})
    assert resp.status_code == 200
    labels = {n["label"] for n in resp.json()["graph"]["nodes"]}
    assert {"Finance", "Ledger Svc"} <= labels
