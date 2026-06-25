"""Manage custom SHACL-style rules added via the API.

Custom rules are stored in memory (serialised to a JSON sidecar so they survive
restarts). Each rule maps to a SHACL PropertyShape that is returned alongside
the static shapes when querying the rulebook.

Custom rules are global (schema-level, not per-project) — the same as the
static SHACL shapes they extend.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from .. import namespaces as ns

_STORE: dict[str, dict[str, Any]] = {}
_SIDECAR: Path | None = None


def init(data_dir: str | Path | None = None) -> None:
    """Initialise the custom rules store; load persisted rules if available."""
    global _SIDECAR, _STORE  # noqa: PLW0603
    if data_dir:
        _SIDECAR = Path(data_dir) / "custom_rules.json"
        if _SIDECAR.exists():
            try:
                _STORE = json.loads(_SIDECAR.read_text())
            except (json.JSONDecodeError, OSError):
                _STORE = {}
    else:
        _SIDECAR = None
        _STORE = {}


def _persist() -> None:
    if _SIDECAR:
        try:
            _SIDECAR.write_text(json.dumps(_STORE, indent=2))
        except OSError:
            pass


def _rule_to_turtle(rule: dict[str, Any]) -> str:
    """Render a custom rule as a SHACL NodeShape Turtle fragment."""
    rel_meta = ns.REL_BY_KEY.get(rule["relationship"])
    kind_meta = ns.KIND_BY_KEY.get(rule["object_kind"])
    if not rel_meta or not kind_meta:
        return ""
    rel_iri = rel_meta["iri"]
    kind_iri = kind_meta["iri"]
    severity_iri = f"http://www.w3.org/ns/shacl#{rule['severity']}"
    message = rule["message"].replace('"', '\\"')
    shape_iri = f"https://weave.dev/ontology#{rule['id']}"
    return (
        f"<{shape_iri}> a <http://www.w3.org/ns/shacl#NodeShape> ;\n"
        f"    <http://www.w3.org/ns/shacl#targetSubjectsOf> <{rel_iri}> ;\n"
        f"    <http://www.w3.org/ns/shacl#property> [\n"
        f"        <http://www.w3.org/ns/shacl#path> <{rel_iri}> ;\n"
        f"        <http://www.w3.org/ns/shacl#class> <{kind_iri}> ;\n"
        f"        <http://www.w3.org/ns/shacl#severity> <{severity_iri}> ;\n"
        f'        <http://www.w3.org/ns/shacl#message> "{message}" ] .\n'
    )


def custom_shapes_turtle() -> str:
    """Return all custom rules as a Turtle string for merging into the shapes graph."""
    fragments = [_rule_to_turtle(r) for r in _STORE.values()]
    return "\n".join(f for f in fragments if f)


def list_rules() -> list[dict[str, Any]]:
    return list(_STORE.values())


def add_rule(
    relationship: str,
    object_kind: str,
    severity: str = "Violation",
    message: str | None = None,
) -> dict[str, Any]:
    """Create and persist a new custom rule; invalidate the SHACL shapes cache."""
    rule_id = f"Custom_{uuid.uuid4().hex[:8]}"
    kind_meta = ns.KIND_BY_KEY.get(object_kind)
    rel_meta = ns.REL_BY_KEY.get(relationship)

    if kind_meta is None:
        raise ValueError(f"Unknown node kind: {object_kind!r}")
    if rel_meta is None:
        raise ValueError(f"Unknown relationship type: {relationship!r}")

    record = {
        "id": rule_id,
        "category": "Custom",
        "relationship": relationship,
        "object_kind": object_kind,
        "object_kind_curie": ns.curie(kind_meta["iri"]),
        "severity": severity,
        "message": message or (
            f"When using '{rel_meta['label']}', the target must be a {object_kind}."
        ),
        "is_custom": True,
    }
    _STORE[rule_id] = record
    _persist()
    _invalidate_shapes_cache()
    return record


def remove_rule(rule_id: str) -> bool:
    """Remove a custom rule by id; returns True if found and removed."""
    if rule_id in _STORE:
        del _STORE[rule_id]
        _persist()
        _invalidate_shapes_cache()
        return True
    return False


def _invalidate_shapes_cache() -> None:
    """Clear the shapes_graph() LRU cache so new rules are picked up on next use."""
    from .shacl import shapes_graph

    shapes_graph.cache_clear()
