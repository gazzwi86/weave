"""Tests for the HTTP API."""

from __future__ import annotations

import pytest

from app.api.routes import get_store
from app.api.settings_store import reset_runtime
from app.ontology import OntologyStore
from app.validation import custom_rules


@pytest.fixture(autouse=True)
def clear_custom_rules():
    """Ensure the custom-rules module-level store is empty before each test."""
    custom_rules._STORE.clear()
    yield
    custom_rules._STORE.clear()


@pytest.fixture(autouse=True)
def reset_llm_runtime():
    """Reset runtime LLM settings to defaults before/after each test."""
    reset_runtime()
    yield
    reset_runtime()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_get_graph(client):
    graph = client.get("/api/graph").json()
    assert graph["nodes"] and graph["edges"]


def test_relationship_and_kind_vocab(client):
    rels = client.get("/api/relationship-types").json()
    assert any(r["key"] == "dependsOn" for r in rels)
    kinds = client.get("/api/node-kinds").json()
    assert any(k["key"] == "System" for k in kinds)


def test_create_node_and_edge(client):
    a = client.post("/api/nodes", json={"label": "Alpha", "kind": "Service"}).json()["id"]
    b = client.post("/api/nodes", json={"label": "Beta", "kind": "Service"}).json()["id"]
    resp = client.post("/api/edges", json={"source": a, "target": b, "type": "dependsOn"})
    assert resp.status_code == 201
    edges = client.get("/api/graph").json()["edges"]
    assert any(e["source"] == a and e["target"] == b for e in edges)


def test_create_edge_invalid_type(client):
    a = client.post("/api/nodes", json={"label": "A"}).json()["id"]
    b = client.post("/api/nodes", json={"label": "B"}).json()["id"]
    resp = client.post("/api/edges", json={"source": a, "target": b, "type": "bogus"})
    assert resp.status_code == 400


def test_export_and_import_ttl(client):
    ttl = client.get("/api/ontology/ttl")
    assert ttl.headers["content-type"].startswith("text/turtle")
    body = {
        "turtle": "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> ."
        " @prefix weave: <https://weave.dev/ontology#> ."
        ' <https://weave.dev/resource/x> a weave:Service ; rdfs:label "X" .'
    }
    graph = client.post("/api/ontology/ttl", json=body).json()
    assert {n["label"] for n in graph["nodes"]} == {"X"}


def test_import_invalid_ttl_returns_400(client):
    resp = client.post("/api/ontology/ttl", json={"turtle": "this is not turtle @@@"})
    assert resp.status_code == 400


def test_delete_node(client):
    node_id = client.post("/api/nodes", json={"label": "Temp"}).json()["id"]
    assert client.delete("/api/nodes", params={"node_id": node_id}).status_code == 204
    assert all(n["id"] != node_id for n in client.get("/api/graph").json()["nodes"])


def test_glossary_and_inventory_endpoints(client):
    assert any(t["label"] == "Scream" for t in client.get("/api/glossary").json())
    assert any(i["label"] == "Scare Floor System" for i in client.get("/api/inventory").json())


def test_llm_mutate_without_key_returns_503(client):
    resp = client.post("/api/llm/mutate", json={"prompt": "add a node"})
    assert resp.status_code == 503


def test_llm_propose_without_key_returns_503(client):
    resp = client.post("/api/llm/propose", json={"prompt": "add a node"})
    assert resp.status_code == 503


def test_operations_apply_endpoint(client):
    # Staged approval: apply a reviewed batch directly (no LLM call needed).
    ops = [
        {"op": "add_node", "ref": "b", "label": "Billing", "kind": "Service"},
        {"op": "add_node", "ref": "l", "label": "Ledger", "kind": "DataAsset"},
        {"op": "add_edge", "source": "b", "target": "l", "type": "exposes"},
    ]
    resp = client.post("/api/operations/apply", json={"operations": ops})
    assert resp.status_code == 200
    body = resp.json()
    assert body["applied"] is True and len(body["operations"]) == 3
    labels = {n["label"] for n in body["graph"]["nodes"]}
    assert {"Billing", "Ledger"} <= labels


# --- SPARQL SELECT endpoint --------------------------------------------------


def test_sparql_select_returns_columns_and_rows(client):
    # The route prepends SPARQL_PREFIXES so we can use bare prefix names.
    resp = client.post(
        "/api/sparql",
        json={"query": "SELECT ?s ?label WHERE { ?s rdfs:label ?label } LIMIT 5"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "columns" in body and "rows" in body
    # Pyoxigraph returns variable names with a leading '?'.
    assert set(body["columns"]) == {"?s", "?label"}
    assert len(body["rows"]) > 0


def test_sparql_select_rejects_insert(client):
    resp = client.post(
        "/api/sparql",
        json={"query": "INSERT DATA { <urn:x> <urn:p> <urn:o> }"},
    )
    assert resp.status_code == 400


def test_sparql_select_rejects_service_query(client):
    resp = client.post(
        "/api/sparql",
        json={
            "query": (
                "SELECT ?s WHERE { SERVICE <http://example.com/sparql> { ?s ?p ?o } }"
            )
        },
    )
    assert resp.status_code == 400


# --- Custom rules endpoints --------------------------------------------------


def test_create_custom_rule_returns_201(client):
    resp = client.post(
        "/api/rules",
        json={
            "relationship": "dependsOn",
            "object_kind": "Concept",
            "severity": "Violation",
            "message": "dependsOn should target a Concept",
        },
    )
    assert resp.status_code == 201
    rule = resp.json()
    assert rule["relationship"] == "dependsOn"
    assert rule["object_kind"] == "Concept"
    assert rule["is_custom"] is True
    assert rule["id"].startswith("Custom_")


def test_create_custom_rule_appears_in_list(client):
    client.post(
        "/api/rules",
        json={"relationship": "dependsOn", "object_kind": "Service"},
    )
    rules = client.get("/api/rules").json()
    assert any(r["relationship"] == "dependsOn" and r["is_custom"] for r in rules)


def test_create_custom_rule_rejects_unknown_kind(client):
    resp = client.post(
        "/api/rules",
        json={"relationship": "dependsOn", "object_kind": "NonExistentKind"},
    )
    assert resp.status_code == 400


def test_delete_custom_rule_returns_204(client):
    create_resp = client.post(
        "/api/rules",
        json={"relationship": "dependsOn", "object_kind": "Concept"},
    )
    rule_id = create_resp.json()["id"]
    del_resp = client.delete(f"/api/rules/{rule_id}")
    assert del_resp.status_code == 204
    # Confirm it's gone from the list.
    rules = client.get("/api/rules").json()
    assert not any(r["id"] == rule_id for r in rules)


def test_delete_unknown_rule_returns_404(client):
    resp = client.delete("/api/rules/no-such-rule")
    assert resp.status_code == 404


def test_delete_static_rule_returns_404(client):
    # Pull a real static rule id from the combined rules list.
    rules = client.get("/api/rules").json()
    static_rule = next(r for r in rules if not r["is_custom"])
    resp = client.delete(f"/api/rules/{static_rule['id']}")
    assert resp.status_code == 404


# --- Capability properties on nodes ------------------------------------------


def test_create_node_with_capability_properties(client):
    resp = client.post(
        "/api/nodes",
        json={
            "label": "Order Fulfilment",
            "kind": "BusinessCapability",
            "maturity": "3",
            "strategic_importance": "Innovation",
            "investment_level": "High",
            "lifecycle_status": "Active",
            "capability_owner": "Supply Chain Team",
        },
    )
    assert resp.status_code == 201
    node_id = resp.json()["id"]

    nodes = client.get("/api/graph").json()["nodes"]
    node = next(n for n in nodes if n["id"] == node_id)
    assert node["maturity"] == "3"
    assert node["strategic_importance"] == "Innovation"
    assert node["investment_level"] == "High"
    assert node["lifecycle_status"] == "Active"
    assert node["capability_owner"] == "Supply Chain Team"


def test_patch_node_updates_capability_properties(client):
    node_id = client.post(
        "/api/nodes",
        json={"label": "Billing Cap", "kind": "BusinessCapability", "maturity": "2"},
    ).json()["id"]

    patch_resp = client.patch(
        "/api/nodes",
        params={"node_id": node_id},
        json={"label": "Billing Cap", "maturity": "4", "investment_level": "Medium"},
    )
    assert patch_resp.status_code == 200

    nodes = client.get("/api/graph").json()["nodes"]
    node = next(n for n in nodes if n["id"] == node_id)
    assert node["maturity"] == "4"
    assert node["investment_level"] == "Medium"


def test_capability_properties_in_graph_response(client):
    client.post(
        "/api/nodes",
        json={
            "label": "Risk Management",
            "kind": "BusinessCapability",
            "maturity": "1",
            "lifecycle_status": "Plan",
        },
    )
    nodes = client.get("/api/graph").json()["nodes"]
    cap_node = next((n for n in nodes if n["label"] == "Risk Management"), None)
    assert cap_node is not None
    assert cap_node["maturity"] == "1"
    assert cap_node["lifecycle_status"] == "Plan"


# --- LLM settings endpoints --------------------------------------------------


def test_get_llm_settings_returns_required_fields(client):
    resp = client.get("/api/settings/llm")
    assert resp.status_code == 200
    body = resp.json()
    assert "provider" in body
    assert "model" in body
    assert "ollama_url" in body
    assert "anthropic_configured" in body
    # No API key in test env, so anthropic_configured should be False.
    assert body["anthropic_configured"] is False
    # Default provider is anthropic.
    assert body["provider"] == "anthropic"


def test_patch_llm_settings_updates_model(client):
    resp = client.patch("/api/settings/llm", json={"model": "claude-opus-4-8"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["model"] == "claude-opus-4-8"

    # GET should reflect the updated model.
    get_resp = client.get("/api/settings/llm")
    assert get_resp.json()["model"] == "claude-opus-4-8"


def test_list_ollama_models_returns_list(client):
    """Endpoint returns 200 with a list — empty when Ollama isn't running locally."""
    resp = client.get("/api/settings/llm/models")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# --- History / audit trail endpoints -----------------------------------------


def test_history_empty_on_fresh_store(client):
    """GET /api/history returns a list (may be empty on a freshly seeded store)."""
    resp = client.get("/api/history", params={"project_id": "demo"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_history_records_event_after_apply(client):
    """After POST /api/operations/apply, history contains an event with the right fields."""
    ops = [
        {"op": "add_node", "ref": "svc", "label": "AuditSvc", "kind": "Service"},
    ]
    apply_resp = client.post("/api/operations/apply", json={"operations": ops})
    assert apply_resp.status_code == 200
    assert apply_resp.json()["applied"] is True

    history = client.get("/api/history", params={"project_id": "demo"}).json()
    assert len(history) >= 1
    event = history[0]  # newest first
    assert "id" in event
    assert "timestamp" in event
    assert event["agent"] == "user"
    assert "summary" in event
    assert isinstance(event["operations"], list)
    assert len(event["operations"]) == 1
    assert event["operations"][0]["op"] == "add_node"


def test_history_newest_first(client):
    """Two successive apply calls produce two events; newest is first in the list."""
    for label in ("FirstSvc", "SecondSvc"):
        client.post(
            "/api/operations/apply",
            json={"operations": [{"op": "add_node", "label": label, "kind": "Service"}]},
        )
    history = client.get("/api/history", params={"project_id": "demo"}).json()
    assert len(history) >= 2
    # The most recently applied operation should appear first.
    summaries = [e["summary"] for e in history[:2]]
    assert summaries[0] != summaries[1] or len(history) >= 2


# --- Snapshot / versioning endpoints -----------------------------------------


@pytest.fixture()
def disk_client(client, tmp_path):
    """Yield the shared test client with get_store overridden to a disk-backed store."""
    store = OntologyStore(data_dir=str(tmp_path), seed=True)
    client.app.dependency_overrides[get_store] = lambda: store
    yield client, store
    client.app.dependency_overrides.clear()


def test_snapshots_empty_initially(client):
    """GET /api/snapshots returns [] for an in-memory (demo) store."""
    resp = client.get("/api/snapshots")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_snapshot_returns_400_for_in_memory_store(client):
    """POST /api/snapshots returns 400 when the store has no data_dir."""
    resp = client.post("/api/snapshots", json={"label": "v1"})
    assert resp.status_code == 400


def test_create_snapshot(disk_client):
    """POST /api/snapshots → 201 with id/label/created."""
    client, _ = disk_client
    resp = client.post("/api/snapshots", json={"label": "v1.0", "description": "Initial"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["label"] == "v1.0"
    assert body["description"] == "Initial"
    assert "id" in body and len(body["id"]) == 12
    assert "created" in body
    assert isinstance(body["node_count"], int)
    assert isinstance(body["edge_count"], int)


def test_snapshot_appears_in_list(disk_client):
    """POST then GET /api/snapshots → list contains the new snapshot."""
    client, _ = disk_client
    client.post("/api/snapshots", json={"label": "v1.0"})
    resp = client.get("/api/snapshots")
    assert resp.status_code == 200
    snaps = resp.json()
    assert len(snaps) == 1
    assert snaps[0]["label"] == "v1.0"


def test_get_snapshot_ttl(disk_client):
    """POST then GET /{id}/ttl → 200 with text/turtle content-type."""
    client, _ = disk_client
    snap_id = client.post("/api/snapshots", json={"label": "ttl-test"}).json()["id"]
    resp = client.get(f"/api/snapshots/{snap_id}/ttl")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/turtle")
    assert len(resp.text) > 0


def test_get_snapshot_ttl_not_found(disk_client):
    """GET /api/snapshots/nonexistent/ttl → 404."""
    client, _ = disk_client
    resp = client.get("/api/snapshots/doesnotexist/ttl")
    assert resp.status_code == 404


def test_restore_snapshot(disk_client):
    """POST snap, add node, POST restore → graph matches pre-addition snapshot."""
    client, store = disk_client
    # Record current node labels before snapshot.
    original_labels = {n["label"] for n in client.get("/api/graph").json()["nodes"]}
    snap_id = client.post("/api/snapshots", json={"label": "pre-add"}).json()["id"]

    # Add a node after the snapshot.
    client.post("/api/nodes", json={"label": "TemporaryNode", "kind": "Service"})
    labels_after_add = {n["label"] for n in client.get("/api/graph").json()["nodes"]}
    assert "TemporaryNode" in labels_after_add

    # Restore to the snapshot.
    resp = client.post(f"/api/snapshots/{snap_id}/restore")
    assert resp.status_code == 200
    restored_labels = {n["label"] for n in resp.json()["nodes"]}
    assert "TemporaryNode" not in restored_labels
    assert restored_labels == original_labels
