"""Tests for LLM-driven mutations (without calling a real model)."""

from __future__ import annotations

from types import SimpleNamespace

from app.llm import LLMService, apply_operations
from app.llm.service import MUTATION_TOOL
from app.ontology import OntologyStore


def test_mutation_tool_constrains_kinds_and_types():
    props = MUTATION_TOOL["input_schema"]["properties"]["operations"]["items"]["properties"]
    assert "System" in props["kind"]["enum"]
    assert "dependsOn" in props["type"]["enum"]


def test_apply_operations_resolves_refs_between_new_nodes():
    store = OntologyStore(seed=False)
    ops = [
        {"op": "add_node", "ref": "n1", "label": "Billing", "kind": "Service"},
        {"op": "add_node", "ref": "n2", "label": "Ledger", "kind": "DataAsset"},
        {"op": "add_edge", "source": "n1", "target": "n2", "type": "exposes"},
    ]
    applied = apply_operations(store, ops, agent="test")
    assert [a["op"] for a in applied] == ["add_node", "add_node", "add_edge"]
    graph = store.graph()
    labels = {n["label"] for n in graph["nodes"]}
    assert {"Billing", "Ledger"} <= labels
    assert any(e["type"] == "exposes" for e in graph["edges"])


def test_apply_operations_reuses_existing_node_by_label():
    store = OntologyStore(seed=False)
    first = store.add_node({"label": "Order", "kind": "Concept"})
    applied = apply_operations(
        store,
        [{"op": "add_node", "ref": "n", "label": "order", "kind": "Concept"}],
    )
    assert applied[0]["detail"]["reused"] is True
    assert applied[0]["detail"]["id"] == first
    concepts = [n for n in store.graph()["nodes"] if n["label"] == "Order"]
    assert len(concepts) == 1


def test_reconciled_node_ref_resolves_in_later_edge():
    store = OntologyStore(seed=False)
    order = store.add_node({"label": "Order", "kind": "Concept"})
    apply_operations(
        store,
        [
            {"op": "add_node", "ref": "o", "label": "Order", "kind": "Concept"},
            {"op": "add_node", "ref": "c", "label": "Customer", "kind": "Concept"},
            {"op": "add_edge", "source": "o", "target": "c", "type": "related"},
        ],
    )
    edges = store.graph()["edges"]
    assert any(e["source"] == order and e["type"] == "related" for e in edges)


def test_apply_operations_skips_invalid_edge_type():
    store = OntologyStore(seed=False)
    a = store.add_node({"label": "A"})
    b = store.add_node({"label": "B"})
    applied = apply_operations(
        store, [{"op": "add_edge", "source": a, "target": b, "type": "bogus"}]
    )
    assert applied == []


class _FakeMessages:
    def create(self, **kwargs):  # noqa: ANN003
        block = SimpleNamespace(
            type="tool_use",
            name="propose_mutations",
            input={
                "message": "Added a node.",
                "operations": [{"op": "add_node", "label": "Synthetic", "kind": "Concept"}],
            },
        )
        return SimpleNamespace(content=[block])


class _FakeClient:
    def __init__(self):
        self.messages = _FakeMessages()


def test_llm_service_extracts_operations_from_tool_use():
    service = LLMService(api_key="", model="test-model", client=_FakeClient())
    message, operations = service.propose("add a node", {"nodes": [], "edges": []})
    assert message == "Added a node."
    assert operations[0]["label"] == "Synthetic"
