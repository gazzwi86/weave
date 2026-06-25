"""Translate natural language into validated, PROV-stamped RDF mutations.

The model is asked to return a single tool call describing a batch of
operations over the graph. New nodes carry a local `ref` so edges created in
the same batch can point at them before their real IRIs exist; we resolve
those refs as we apply.
"""

from __future__ import annotations

from typing import Any

from .. import namespaces as ns
from ..ontology import OntologyStore

MUTATION_TOOL: dict[str, Any] = {
    "name": "propose_mutations",
    "description": (
        "Propose a batch of changes to the knowledge graph. Reference existing "
        "nodes by their full id. For nodes you create in this batch, give a "
        "short local 'ref' and use that ref as the source/target of edges in "
        "the same batch."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "message": {
                "type": "string",
                "description": "A one-sentence summary of what you changed and why.",
            },
            "operations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "op": {
                            "type": "string",
                            "enum": [
                                "add_node",
                                "update_node",
                                "add_edge",
                                "delete_node",
                                "delete_edge",
                            ],
                        },
                        "ref": {"type": "string"},
                        "id": {"type": "string"},
                        "label": {"type": "string"},
                        "kind": {"type": "string", "enum": [k["key"] for k in ns.NODE_KINDS]},
                        "comment": {"type": "string"},
                        "note": {"type": "string"},
                        "domain": {"type": "string"},
                        "capability": {"type": "string"},
                        "source": {"type": "string"},
                        "target": {"type": "string"},
                        "type": {
                            "type": "string",
                            "enum": [r["key"] for r in ns.RELATIONSHIP_TYPES],
                        },
                    },
                    "required": ["op"],
                },
            },
        },
        "required": ["message", "operations"],
    },
}


def build_system_prompt(graph: dict[str, list[dict[str, Any]]]) -> str:
    kinds = ", ".join(k["key"] for k in ns.NODE_KINDS)
    rels = ", ".join(r["key"] for r in ns.RELATIONSHIP_TYPES)
    node_lines = "\n".join(
        f"- {n['id']} | {n['label']} ({n['kind']})" for n in graph["nodes"][:200]
    )
    return (
        "You curate an RDF/OWL/SKOS knowledge graph for an enterprise.\n"
        f"Valid node kinds: {kinds}.\n"
        f"Valid relationship types: {rels}.\n"
        "Always call the propose_mutations tool exactly once. Reuse existing "
        "nodes where they already represent the concept rather than creating "
        "duplicates.\n\n"
        f"Existing nodes:\n{node_lines or '(none yet)'}"
    )


class LLMService:
    """Wraps the Anthropic client; isolated so tests can inject a fake."""

    def __init__(self, api_key: str, model: str, client: Any | None = None) -> None:
        self._model = model
        if client is not None:
            self._client = client
        else:
            if not api_key:
                raise RuntimeError("ANTHROPIC_API_KEY is not set; LLM features are unavailable.")
            from anthropic import Anthropic

            self._client = Anthropic(api_key=api_key)

    def propose(
        self, prompt: str, graph: dict[str, list[dict[str, Any]]]
    ) -> tuple[str, list[dict[str, Any]]]:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=2048,
            system=build_system_prompt(graph),
            tools=[MUTATION_TOOL],
            tool_choice={"type": "tool", "name": "propose_mutations"},
            messages=[{"role": "user", "content": prompt}],
        )
        return _extract_tool_result(response)

    def generate_sparql(self, question: str, system_prompt: str) -> str:
        """Translate a natural-language question to a SPARQL SELECT query."""
        response = self._client.messages.create(
            model=self._model,
            max_tokens=512,
            system=system_prompt,
            messages=[{"role": "user", "content": question}],
        )
        text = ""
        for block in response.content:
            if getattr(block, "type", None) == "text":
                text = block.text.strip()
                break
        # Strip markdown code fences if the model included them.
        if text.startswith("```"):
            text = "\n".join(text.split("\n")[1:])
        if text.endswith("```"):
            text = "\n".join(text.split("\n")[:-1])
        return text.strip()


def _extract_tool_result(response: Any) -> tuple[str, list[dict[str, Any]]]:
    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "propose_mutations":
            data = block.input
            return data.get("message", ""), data.get("operations", [])
    return "No changes proposed.", []


def apply_operations(
    store: OntologyStore, operations: list[dict[str, Any]], agent: str = "llm"
) -> list[dict[str, Any]]:
    """Apply a validated batch of operations; returns a per-op summary."""
    refs: dict[str, str] = {}
    applied: list[dict[str, Any]] = []
    for raw in operations:
        handler = _HANDLERS.get(raw.get("op"))
        if handler is None:
            continue
        summary = handler(store, raw, refs)
        if summary is not None:
            applied.append(summary)
    if applied:
        store.stamp_activity(agent, f"Applied {len(applied)} operation(s).")
    return applied


def _resolve(refs: dict[str, str], value: str | None) -> str | None:
    if value is None:
        return None
    return refs.get(value, value)


def _resolve_edge(refs: dict[str, str], raw: dict[str, Any]) -> tuple[str, str] | None:
    """Resolve and validate an edge's endpoints and type, or None if invalid."""
    source = _resolve(refs, raw.get("source"))
    target = _resolve(refs, raw.get("target"))
    if not source or not target or raw.get("type") not in ns.REL_BY_KEY:
        return None
    return source, target


def _op_add_node(store: OntologyStore, raw: dict[str, Any], refs: dict[str, str]) -> dict[str, Any]:
    label = raw.get("label", "Untitled")
    kind = raw.get("kind", ns.DEFAULT_KIND)
    # Reconcile against an existing same-label, same-kind node to avoid creating
    # a duplicate of a concept the graph already has.
    existing = store.find_node_by_label(label, kind)
    if existing:
        if raw.get("ref"):
            refs[raw["ref"]] = existing
        return {
            "op": "add_node",
            "summary": f"Reused existing node '{label}'",
            "detail": {"id": existing, "reused": True},
        }
    node_id = store.add_node(
        {
            "label": label,
            "kind": kind,
            "comment": raw.get("comment"),
            "note": raw.get("note"),
            "domain": _resolve(refs, raw.get("domain")),
            "capability": _resolve(refs, raw.get("capability")),
        }
    )
    if raw.get("ref"):
        refs[raw["ref"]] = node_id
    return {
        "op": "add_node",
        "summary": f"Added node '{label}'",
        "detail": {"id": node_id},
    }


def _op_update_node(
    store: OntologyStore, raw: dict[str, Any], refs: dict[str, str]
) -> dict[str, Any] | None:
    node_id = _resolve(refs, raw.get("id"))
    if not node_id:
        return None
    # Forward only the fields the model actually supplied so a partial edit
    # never wipes position/colour/domain/capability.
    fields = {k: raw[k] for k in ("label", "kind", "comment", "note") if k in raw}
    store.update_node(node_id, fields)
    return {
        "op": "update_node",
        "summary": f"Updated node '{raw.get('label') or node_id}'",
        "detail": {"id": node_id},
    }


def _op_add_edge(
    store: OntologyStore, raw: dict[str, Any], refs: dict[str, str]
) -> dict[str, Any] | None:
    resolved = _resolve_edge(refs, raw)
    if resolved is None:
        return None
    source, target = resolved
    store.add_edge(
        {
            "source": source,
            "target": target,
            "type": raw["type"],
            "comment": raw.get("comment"),
            "note": raw.get("note"),
        }
    )
    src, tgt = ns.local_name(source), ns.local_name(target)
    return {
        "op": "add_edge",
        "summary": f"Linked {src} —{raw['type']}→ {tgt}",
        "detail": {"source": source, "target": target, "type": raw["type"]},
    }


def _op_delete_node(
    store: OntologyStore, raw: dict[str, Any], refs: dict[str, str]
) -> dict[str, Any] | None:
    node_id = _resolve(refs, raw.get("id"))
    if not node_id:
        return None
    store.delete_node(node_id)
    return {
        "op": "delete_node",
        "summary": f"Deleted node {ns.local_name(node_id)}",
        "detail": {"id": node_id},
    }


def _op_delete_edge(
    store: OntologyStore, raw: dict[str, Any], refs: dict[str, str]
) -> dict[str, Any] | None:
    resolved = _resolve_edge(refs, raw)
    if resolved is None:
        return None
    source, target = resolved
    store.delete_edge(source, target, raw["type"])
    return {
        "op": "delete_edge",
        "summary": f"Removed {ns.local_name(source)} —{raw['type']}→ {ns.local_name(target)}",
        "detail": {"source": source, "target": target, "type": raw["type"]},
    }


_HANDLERS = {
    "add_node": _op_add_node,
    "update_node": _op_update_node,
    "add_edge": _op_add_edge,
    "delete_node": _op_delete_node,
    "delete_edge": _op_delete_edge,
}
