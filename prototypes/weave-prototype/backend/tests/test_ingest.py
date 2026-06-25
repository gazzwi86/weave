"""Tests for schema ingestion."""

from __future__ import annotations

import pytest

from app.ingest import import_schema, parse_schema
from app.ontology import OntologyStore

CSV_CONTENT = "id,email,created_at,amount\n42,a@b.com,2024-01-02,19.99\n"
JSON_SCHEMA = """
{
  "type": "object",
  "properties": {
    "id": {"type": "integer"},
    "name": {"type": "string"},
    "active": {"type": "boolean"},
    "score": {"type": "number"}
  }
}
"""


def test_parse_csv_infers_types():
    fields = parse_schema("csv", CSV_CONTENT)
    by_name = {f["name"]: f["type"] for f in fields}
    assert by_name == {
        "id": "integer",
        "email": "string",
        "created_at": "date",
        "amount": "decimal",
    }


def test_parse_json_schema_maps_types():
    fields = parse_schema("json_schema", JSON_SCHEMA)
    by_name = {f["name"]: f["type"] for f in fields}
    assert by_name == {
        "id": "integer",
        "name": "string",
        "active": "boolean",
        "score": "decimal",
    }


def test_unsupported_format_rejected():
    with pytest.raises(ValueError):
        parse_schema("xml", "<x/>")


def test_import_csv_creates_asset_and_fields():
    store = OntologyStore(seed=False)
    result = import_schema(store, "Orders", "csv", CSV_CONTENT)
    graph = store.graph()
    asset = next(n for n in graph["nodes"] if n["id"] == result["asset_id"])
    assert asset["label"] == "Orders" and asset["kind"] == "DataAsset"

    fields = [n for n in graph["nodes"] if n["kind"] == "Field"]
    assert {f["label"] for f in fields} == {"id", "email", "created_at", "amount"}
    # Every field is partOf the asset and carries an xsd type note.
    part_of = [
        e for e in graph["edges"] if e["type"] == "partOf" and e["target"] == result["asset_id"]
    ]
    assert len(part_of) == 4
    amount = next(f for f in fields if f["label"] == "amount")
    assert amount["note"] == "xsd:decimal"


def test_import_links_concept_when_given():
    store = OntologyStore(seed=False)
    concept = store.add_node({"label": "Order", "kind": "Concept"})
    result = import_schema(store, "Orders", "csv", CSV_CONTENT, concept=concept)
    describes = [
        e
        for e in store.graph()["edges"]
        if e["type"] == "describes" and e["source"] == result["asset_id"] and e["target"] == concept
    ]
    assert len(describes) == 1


def test_import_schema_endpoint(client):
    resp = client.post(
        "/api/schema/import",
        json={"name": "Customers", "format": "csv", "content": "id,name\n1,Ada\n"},
    )
    assert resp.status_code == 200
    labels = {n["label"] for n in resp.json()["nodes"]}
    assert {"Customers", "id", "name"} <= labels


def test_import_schema_bad_json_returns_400(client):
    resp = client.post(
        "/api/schema/import",
        json={"name": "Broken", "format": "json_schema", "content": "{not json"},
    )
    assert resp.status_code == 400
