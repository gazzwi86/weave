"""Tests for multi-project support."""

from __future__ import annotations


def test_demo_project_present(client):
    projects = client.get("/api/projects").json()
    demo = next(p for p in projects if p["id"] == "demo")
    assert demo["is_demo"] is True
    assert demo["node_count"] > 0 and demo["edge_count"] > 0


def test_create_empty_project_and_isolate_from_demo(client):
    created = client.post("/api/projects", json={"name": "Blank", "seed": "empty"}).json()
    pid = created["id"]
    assert created["node_count"] == 0

    # A node added to the new project must not appear in the demo project.
    node_id = client.post(
        "/api/nodes", params={"project_id": pid}, json={"label": "Solo", "kind": "Service"}
    ).json()["id"]
    new_graph = client.get("/api/graph", params={"project_id": pid}).json()
    demo_graph = client.get("/api/graph", params={"project_id": "demo"}).json()
    assert any(n["id"] == node_id for n in new_graph["nodes"])
    assert all(n["id"] != node_id for n in demo_graph["nodes"])


def test_create_project_seeded_from_demo(client):
    created = client.post("/api/projects", json={"name": "Copy", "seed": "demo"}).json()
    assert created["node_count"] > 0


def test_rename_project(client):
    pid = client.post("/api/projects", json={"name": "Old"}).json()["id"]
    renamed = client.patch(f"/api/projects/{pid}", json={"name": "New"}).json()
    assert renamed["name"] == "New"


def test_delete_project(client):
    pid = client.post("/api/projects", json={"name": "Temp"}).json()["id"]
    assert client.delete(f"/api/projects/{pid}").status_code == 204
    assert all(p["id"] != pid for p in client.get("/api/projects").json())


def test_cannot_delete_demo(client):
    assert client.delete("/api/projects/demo").status_code == 400


def test_unknown_project_returns_404(client):
    assert client.get("/api/graph", params={"project_id": "nope"}).status_code == 404
