"""OntologyStore — a thin, opinionated wrapper around an Oxigraph triple store.

It hides RDF mechanics behind a node/edge API the rest of the app speaks:
projecting the graph for the canvas, CRUD on nodes and labelled relationships
(with reified annotations), Turtle import/export, glossary and inventory
views, and PROV-stamped LLM mutations.
"""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pyoxigraph import DefaultGraph, Literal, NamedNode, Quad, RdfFormat, Store

from .. import namespaces as ns

_SLUG_RE = re.compile(r"[^a-z0-9]+")

# Type alias: a subject's properties as collected from the store.
Props = dict[str, list[tuple[str, Any]]]


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _slug(label: str) -> str:
    s = _SLUG_RE.sub("-", label.lower()).strip("-")
    return s or "node"


def _edge_id(s: str, p: str, o: str) -> str:
    return hashlib.sha1(f"{s}\n{p}\n{o}".encode()).hexdigest()[:16]


def _iri(value: str) -> NamedNode:
    return NamedNode(value)


def _text(value: str, lang: str | None = None) -> Literal:
    return Literal(value, language=lang) if lang else Literal(value)


def _double(value: float) -> Literal:
    return Literal(str(value), datatype=NamedNode(ns.XSD + "double"))


# Scalar/association node fields: payload key -> (predicate IRI, value→term).
# Single source of truth for writing and (on update) clearing these.
_SCALAR_FIELDS: dict[str, tuple[str, Any]] = {
    "comment": (ns.RDFS + "comment", _text),
    "note": (ns.WEAVE + "note", _text),
    "color": (ns.WEAVE + "color", _text),
    "domain": (ns.WEAVE + "inDomain", _iri),
    "capability": (ns.WEAVE + "hasCapability", _iri),
    # Capability maturity / EA properties
    "maturity": (ns.WEAVE + "maturity", _text),
    "target_maturity": (ns.WEAVE + "targetMaturity", _text),
    "strategic_importance": (ns.WEAVE + "strategicImportance", _text),
    "investment_level": (ns.WEAVE + "investmentLevel", _text),
    "lifecycle_status": (ns.WEAVE + "lifecycleStatus", _text),
    "capability_owner": (ns.WEAVE + "capabilityOwner", _text),
}


def _val(term: Any) -> str | None:
    return term.value if term is not None else None


def _num(term: Any) -> float | None:
    try:
        return float(term.value) if term is not None else None
    except (ValueError, AttributeError):
        return None


class OntologyStore:
    """Stateful façade over a persistent Oxigraph dataset (default graph)."""

    def __init__(self, data_dir: str | None = None, seed: bool = False) -> None:
        self._data_dir = data_dir
        self._history: list[dict] = []
        if data_dir:
            Path(data_dir).mkdir(parents=True, exist_ok=True)
            self._store = Store(data_dir)
        else:
            self._store = Store()  # in-memory (tests)
        if seed and len(self._store) == 0:
            from .seed import DEMO_TURTLE

            self.import_turtle(DEMO_TURTLE)

    # --- Turtle interchange ------------------------------------------------

    def import_turtle(self, turtle: str, replace: bool = True) -> None:
        if replace:
            self._store.clear()
        self._store.load(turtle, format=RdfFormat.TURTLE)

    def export_turtle(self) -> str:
        data = self._store.dump(
            format=RdfFormat.TURTLE,
            from_graph=DefaultGraph(),
            prefixes=ns.PREFIXES,
        )
        return data.decode("utf-8")

    # --- Low-level helpers -------------------------------------------------

    def _add(self, s: NamedNode, p: str, o: Any) -> None:
        self._store.add(Quad(s, _iri(p), o))

    def _remove_pattern(self, s=None, p=None, o=None) -> None:
        for quad in list(self._store.quads_for_pattern(s, p, o)):
            self._store.remove(quad)

    def _first_object(self, subject: str, pred: str) -> str | None:
        for q in self._store.quads_for_pattern(_iri(subject), _iri(pred), None):
            return q.object.value
        return None

    def _new_node_iri(self, label: str) -> NamedNode:
        return _iri(f"{ns.RESOURCE}{_slug(label)}-{uuid.uuid4().hex[:8]}")

    def _node_kind_key(self, node_id: str) -> str:
        types = [
            q.object.value
            for q in self._store.quads_for_pattern(_iri(node_id), _iri(ns.RDF + "type"), None)
        ]
        return self._primary_kind(types)["key"]

    def find_node_by_label(self, label: str, kind: str | None = None) -> str | None:
        """Return the id of an existing node with this label (case-insensitive).

        Used to reconcile LLM-proposed nodes against the graph so the same
        concept is not duplicated. When ``kind`` is given it must also match.
        """
        target = label.strip().casefold()
        for q in self._store.quads_for_pattern(None, _iri(ns.RDFS + "label"), None):
            if not isinstance(q.object, Literal) or q.object.value.strip().casefold() != target:
                continue
            node_id = q.subject.value
            if kind is None or self._node_kind_key(node_id) == kind:
                return node_id
        return None

    # --- Node CRUD ---------------------------------------------------------

    def add_node(self, payload: dict[str, Any]) -> str:
        node = self._new_node_iri(payload["label"])
        self._set_kind(node, payload.get("kind") or ns.DEFAULT_KIND)
        self._add(node, ns.DCTERMS + "created", _text(_now()))
        self._add(node, ns.RDFS + "label", _text(payload["label"]))
        for key, (pred, conv) in _SCALAR_FIELDS.items():
            if payload.get(key):
                self._add(node, pred, conv(payload[key]))
        self._apply_position(node, payload, clear=False)
        return node.value

    def update_node(self, node_id: str, payload: dict[str, Any]) -> None:
        # Partial update: only fields present in the payload are touched, so an
        # LLM edit that omits position/colour/domain never wipes them.
        node = _iri(node_id)
        if payload.get("label"):
            self._remove_pattern(node, _iri(ns.RDFS + "label"), None)
            self._add(node, ns.RDFS + "label", _text(payload["label"]))
        if payload.get("kind"):
            self._set_kind(node, payload["kind"])
        for key, (pred, conv) in _SCALAR_FIELDS.items():
            if key in payload:
                self._remove_pattern(node, _iri(pred), None)
                if payload[key]:
                    self._add(node, pred, conv(payload[key]))
        if "x" in payload or "y" in payload:
            self._apply_position(node, payload, clear=True)

    def _set_kind(self, node: NamedNode, key: str) -> None:
        self._remove_pattern(node, _iri(ns.RDF + "type"), None)
        kind = ns.KIND_BY_KEY.get(key, ns.KIND_BY_KEY[ns.DEFAULT_KIND])
        self._add(node, ns.RDF + "type", _iri(kind["iri"]))

    def _apply_position(self, node: NamedNode, payload: dict[str, Any], clear: bool) -> None:
        if clear:
            self._remove_pattern(node, _iri(ns.WEAVE + "x"), None)
            self._remove_pattern(node, _iri(ns.WEAVE + "y"), None)
        if payload.get("x") is not None and payload.get("y") is not None:
            self._add(node, ns.WEAVE + "x", _double(float(payload["x"])))
            self._add(node, ns.WEAVE + "y", _double(float(payload["y"])))

    def delete_node(self, node_id: str) -> None:
        node = _iri(node_id)
        self._remove_pattern(node, None, None)  # outgoing
        self._remove_pattern(None, None, node)  # incoming
        self._remove_reifications_for_node(node_id)

    def _remove_reifications_for_node(self, node_id: str) -> None:
        # Find reification statements touching the node via two targeted lookups
        # rather than scanning every statement.
        node = _iri(node_id)
        stmts: set[str] = set()
        for pred in (ns.RDF + "subject", ns.RDF + "object"):
            for q in self._store.quads_for_pattern(None, _iri(pred), node):
                stmts.add(q.subject.value)
        for stmt in stmts:
            self._remove_pattern(_iri(stmt), None, None)

    # --- Edge CRUD ---------------------------------------------------------

    def add_edge(self, payload: dict[str, Any]) -> str:
        rel = ns.REL_BY_KEY.get(payload["type"])
        if not rel:
            raise ValueError(f"Unknown relationship type: {payload['type']}")
        s, o = _iri(payload["source"]), _iri(payload["target"])
        self._store.add(Quad(s, _iri(rel["iri"]), o))
        if payload.get("comment") or payload.get("note"):
            self._reify(payload["source"], rel["iri"], payload["target"], payload)
        return _edge_id(payload["source"], rel["iri"], payload["target"])

    def _reify(self, s: str, p: str, o: str, payload: dict[str, Any]) -> None:
        stmt = _iri(f"{ns.RESOURCE}stmt-{_edge_id(s, p, o)}")
        self._add(stmt, ns.RDF + "type", _iri(ns.RDF + "Statement"))
        self._add(stmt, ns.RDF + "subject", _iri(s))
        self._add(stmt, ns.RDF + "predicate", _iri(p))
        self._add(stmt, ns.RDF + "object", _iri(o))
        if payload.get("comment"):
            self._add(stmt, ns.RDFS + "comment", _text(payload["comment"]))
        if payload.get("note"):
            self._add(stmt, ns.WEAVE + "note", _text(payload["note"]))

    def delete_edge(self, source: str, target: str, type_key: str) -> None:
        rel = ns.REL_BY_KEY.get(type_key)
        if not rel:
            raise ValueError(f"Unknown relationship type: {type_key}")
        self._remove_pattern(_iri(source), _iri(rel["iri"]), _iri(target))
        stmt = f"{ns.RESOURCE}stmt-{_edge_id(source, rel['iri'], target)}"
        self._remove_pattern(_iri(stmt), None, None)

    # --- Projection for the canvas ----------------------------------------

    def graph(self) -> dict[str, list[dict[str, Any]]]:
        props = self._collect_props()
        statements = self._statement_subjects(props)
        annotations = self._edge_annotations(props, statements)
        nodes = self._build_nodes(props, statements)
        edges = self._build_edges(props, statements, annotations)
        self._ensure_edge_endpoints(nodes, edges)
        return {"nodes": list(nodes.values()), "edges": edges}

    def _collect_props(self) -> Props:
        props: Props = defaultdict(list)
        for q in self._store.quads_for_pattern(None, None, None):
            if isinstance(q.subject, NamedNode):
                props[q.subject.value].append((q.predicate.value, q.object))
        return props

    @staticmethod
    def _statement_subjects(props: Props) -> set[str]:
        return {
            subj
            for subj, plist in props.items()
            if any(
                p == ns.RDF + "type" and getattr(o, "value", None) == ns.RDF + "Statement"
                for p, o in plist
            )
        }

    @staticmethod
    def _edge_annotations(
        props: Props, statements: set[str]
    ) -> dict[tuple[str, str, str], dict[str, str]]:
        # Reconstruct edge annotations from the props already in memory — no
        # extra store round-trips.
        out: dict[tuple[str, str, str], dict[str, str]] = {}
        for stmt in statements:
            scalars = {p: o for p, o in props[stmt]}
            s, p, o = (
                scalars.get(ns.RDF + "subject"),
                scalars.get(ns.RDF + "predicate"),
                scalars.get(ns.RDF + "object"),
            )
            if not (s and p and o):
                continue
            anno = {}
            if ns.RDFS + "comment" in scalars:
                anno["comment"] = scalars[ns.RDFS + "comment"].value
            if ns.WEAVE + "note" in scalars:
                anno["note"] = scalars[ns.WEAVE + "note"].value
            if anno:
                out[(s.value, p.value, o.value)] = anno
        return out

    def _build_nodes(self, props: Props, statements: set[str]) -> dict[str, dict[str, Any]]:
        nodes: dict[str, dict[str, Any]] = {}
        for subj, plist in props.items():
            if subj in statements:
                continue
            types = [o.value for p, o in plist if p == ns.RDF + "type"]
            has_label = any(p == ns.RDFS + "label" for p, _ in plist)
            if not has_label and not any(t in ns.KIND_BY_IRI for t in types):
                continue
            nodes[subj] = self._node_record(subj, plist, types)
        return nodes

    @staticmethod
    def _node_record(subj: str, plist: list[tuple[str, Any]], types: list[str]) -> dict[str, Any]:
        scalars = {p: o for p, o in plist}
        kind = OntologyStore._primary_kind(types)
        return {
            "id": subj,
            "label": _val(scalars.get(ns.RDFS + "label")) or ns.local_name(subj),
            "kind": kind["key"],
            "color": _val(scalars.get(ns.WEAVE + "color")) or kind["color"],
            "comment": _val(scalars.get(ns.RDFS + "comment")),
            "note": _val(scalars.get(ns.WEAVE + "note")),
            "domain": _val(scalars.get(ns.WEAVE + "inDomain")),
            "capability": _val(scalars.get(ns.WEAVE + "hasCapability")),
            "maturity": _val(scalars.get(ns.WEAVE + "maturity")),
            "target_maturity": _val(scalars.get(ns.WEAVE + "targetMaturity")),
            "strategic_importance": _val(scalars.get(ns.WEAVE + "strategicImportance")),
            "investment_level": _val(scalars.get(ns.WEAVE + "investmentLevel")),
            "lifecycle_status": _val(scalars.get(ns.WEAVE + "lifecycleStatus")),
            "capability_owner": _val(scalars.get(ns.WEAVE + "capabilityOwner")),
            "x": _num(scalars.get(ns.WEAVE + "x")),
            "y": _num(scalars.get(ns.WEAVE + "y")),
        }

    @staticmethod
    def _primary_kind(types: list[str]) -> dict[str, str]:
        for kind in ns.NODE_KINDS:
            if kind["iri"] in types:
                return kind
        return ns.KIND_BY_KEY[ns.DEFAULT_KIND]

    @staticmethod
    def _build_edges(
        props: Props,
        statements: set[str],
        annotations: dict[tuple[str, str, str], dict[str, str]],
    ) -> list[dict[str, Any]]:
        edges: list[dict[str, Any]] = []
        for subj, plist in props.items():
            if subj in statements:
                continue
            for pred, obj in plist:
                if pred in ns.NON_EDGE_PREDICATES or not isinstance(obj, NamedNode):
                    continue
                anno = annotations.get((subj, pred, obj.value), {})
                rel = ns.REL_BY_IRI.get(pred)
                edges.append(
                    {
                        "id": _edge_id(subj, pred, obj.value),
                        "source": subj,
                        "target": obj.value,
                        "type": rel["key"] if rel else ns.local_name(pred),
                        "label": rel["label"] if rel else ns.local_name(pred),
                        "comment": anno.get("comment"),
                        "note": anno.get("note"),
                    }
                )
        return edges

    @staticmethod
    def _ensure_edge_endpoints(
        nodes: dict[str, dict[str, Any]], edges: list[dict[str, Any]]
    ) -> None:
        default = ns.KIND_BY_KEY[ns.DEFAULT_KIND]
        for edge in edges:
            for endpoint in (edge["source"], edge["target"]):
                if endpoint not in nodes:
                    nodes[endpoint] = {
                        "id": endpoint,
                        "label": ns.local_name(endpoint),
                        "kind": default["key"],
                        "color": default["color"],
                        "comment": None,
                        "note": None,
                        "domain": None,
                        "capability": None,
                        "x": None,
                        "y": None,
                    }

    # --- Derived views -----------------------------------------------------

    def glossary(self) -> list[dict[str, Any]]:
        rows = self._store.query(
            ns.SPARQL_PREFIXES
            + """
            SELECT ?c ?label ?def ?rel WHERE {
              ?c a skos:Concept .
              OPTIONAL { ?c rdfs:label ?label }
              OPTIONAL { ?c rdfs:comment ?def }
              OPTIONAL { ?c skos:related ?rel }
            } ORDER BY ?label
            """
        )
        terms: dict[str, dict[str, Any]] = {}
        for r in rows:
            cid = r["c"].value
            term = terms.setdefault(
                cid,
                {
                    "id": cid,
                    "label": r["label"].value if r["label"] else ns.local_name(cid),
                    "definition": r["def"].value if r["def"] else None,
                    "related": [],
                },
            )
            if r["rel"] is not None and r["rel"].value not in term["related"]:
                term["related"].append(r["rel"].value)
        return list(terms.values())

    def inventory(self) -> list[dict[str, Any]]:
        graph = self.graph()
        by_id = {n["id"]: n for n in graph["nodes"]}
        deps: dict[str, list[str]] = defaultdict(list)
        for e in graph["edges"]:
            if e["type"] == "dependsOn":
                deps[e["source"]].append(e["target"])
        items = []
        for n in graph["nodes"]:
            if n["kind"] not in ("System", "Service"):
                continue
            items.append(
                {
                    "id": n["id"],
                    "label": n["label"],
                    "kind": n["kind"],
                    "comment": n["comment"],
                    "domain": self._label_of(by_id, n["domain"]),
                    "capability": self._label_of(by_id, n["capability"]),
                    "depends_on": [self._label_of(by_id, d) or d for d in deps.get(n["id"], [])],
                }
            )
        return items

    @staticmethod
    def _label_of(by_id: dict[str, dict[str, Any]], node_id: str | None) -> str | None:
        if not node_id:
            return None
        node = by_id.get(node_id)
        return node["label"] if node else ns.local_name(node_id)

    # --- PROV stamping (used by LLM mutations) -----------------------------

    def stamp_activity(self, agent: str, summary: str) -> str:
        activity = _iri(f"{ns.RESOURCE}activity-{uuid.uuid4().hex[:8]}")
        self._add(activity, ns.RDF + "type", _iri(ns.PROV + "Activity"))
        self._add(activity, ns.DCTERMS + "created", _text(_now()))
        self._add(activity, ns.RDFS + "comment", _text(summary))
        self._add(activity, ns.PROV + "wasAttributedTo", _text(agent))
        return activity.value

    # --- History / audit trail ---------------------------------------------

    def record_history_event(
        self, agent: str, operations: list[dict], timestamp: str
    ) -> None:
        """Persist a history event; appended to a JSONL sidecar or an in-memory list."""
        event: dict = {
            "id": uuid.uuid4().hex,
            "timestamp": timestamp,
            "agent": agent,
            "summary": f"Applied {len(operations)} operation(s)",
            "operations": operations,
        }
        if self._data_dir:
            sidecar = Path(self._data_dir) / "history.jsonl"
            with sidecar.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(event) + "\n")
        else:
            self._history.append(event)

    def get_history(self, limit: int = 100) -> list[dict]:
        """Return the last ``limit`` history events, newest first."""
        if self._data_dir:
            sidecar = Path(self._data_dir) / "history.jsonl"
            if not sidecar.exists():
                return []
            lines = sidecar.read_text(encoding="utf-8").splitlines()
            events = [json.loads(line) for line in lines if line.strip()]
            return list(reversed(events[-limit:]))
        return list(reversed(self._history[-limit:]))

    # --- Snapshot / versioning ------------------------------------------------

    def create_snapshot(self, label: str, description: str = "") -> dict:
        """Export the current graph as a named TTL snapshot; return the snapshot record."""
        if not self._data_dir:
            raise RuntimeError("Snapshots require a disk-backed store.")
        snap_id = uuid.uuid4().hex[:12]
        snap_dir = Path(self._data_dir) / "snapshots"
        snap_dir.mkdir(exist_ok=True)
        ttl = self.export_turtle()
        (snap_dir / f"{snap_id}.ttl").write_text(ttl)
        g = self.graph()
        record = {
            "id": snap_id,
            "label": label,
            "description": description,
            "created": _now(),
            "node_count": len(g["nodes"]),
            "edge_count": len(g["edges"]),
            "status": "draft",
        }
        manifest_path = snap_dir / "manifest.jsonl"
        with manifest_path.open("a") as f:
            f.write(json.dumps(record) + "\n")
        return record

    def list_snapshots(self) -> list[dict]:
        """Return all snapshots newest-first."""
        if not self._data_dir:
            return []
        manifest_path = Path(self._data_dir) / "snapshots" / "manifest.jsonl"
        if not manifest_path.exists():
            return []
        records = []
        for line in manifest_path.read_text().splitlines():
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                pass
        return list(reversed(records))

    def _rewrite_manifest(self, snap_dir: Path, records: list[dict]) -> None:
        """Rewrite the entire manifest from a list of records."""
        manifest_path = snap_dir / "manifest.jsonl"
        with manifest_path.open("w") as f:
            for r in records:
                f.write(json.dumps(r) + "\n")

    def ship_snapshot(self, snapshot_id: str) -> dict:
        """Mark a snapshot as released; deprecate any previously released snapshot."""
        if not self._data_dir:
            raise ValueError("Snapshots require a disk-backed store.")
        snap_dir = Path(self._data_dir) / "snapshots"
        manifest_path = snap_dir / "manifest.jsonl"
        if not manifest_path.exists():
            raise ValueError("No snapshots found.")
        records = []
        found = False
        for line in manifest_path.read_text().splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            if rec["id"] == snapshot_id:
                rec["status"] = "released"
                found = True
            elif rec.get("status") == "released":
                rec["status"] = "deprecated"
            records.append(rec)
        if not found:
            raise ValueError(f"Snapshot {snapshot_id!r} not found.")
        self._rewrite_manifest(snap_dir, records)
        return next(r for r in records if r["id"] == snapshot_id)

    def get_snapshot_ttl(self, snapshot_id: str) -> str:
        """Return the TTL for a specific snapshot; raise ValueError if not found."""
        if not self._data_dir:
            raise ValueError("No snapshots in memory-only store.")
        path = Path(self._data_dir) / "snapshots" / f"{snapshot_id}.ttl"
        if not path.exists():
            raise ValueError(f"Snapshot {snapshot_id!r} not found.")
        return path.read_text()

    def restore_snapshot(self, snapshot_id: str) -> None:
        """Replace the live graph with the content of a snapshot."""
        ttl = self.get_snapshot_ttl(snapshot_id)
        self.import_turtle(ttl)

    # --- SPARQL query (read-only SELECT) ------------------------------------

    def sparql_select(self, query: str) -> dict[str, Any]:
        """Run a read-only SPARQL SELECT query; raise ValueError for unsafe queries."""
        import re as _re

        stripped = query.strip()
        # Reject non-SELECT forms (no UPDATE/INSERT/DELETE/CONSTRUCT/DESCRIBE).
        if not _re.match(r"(?i)(PREFIX\s.*?\s)*SELECT\s", stripped.lstrip()):
            raise ValueError("Only SELECT queries are supported.")
        # Reject federated SERVICE queries (SSRF vector).
        if _re.search(r"\bSERVICE\b", stripped, _re.IGNORECASE):
            raise ValueError("SERVICE (federated) queries are not supported.")
        rows = self._store.query(query)
        columns = list(rows.variables)
        results: list[dict[str, str | None]] = []
        for row in rows:
            record: dict[str, str | None] = {}
            for col in columns:
                term = row[col]  # type: ignore[call-overload]
                record[str(col)] = term.value if term is not None else None
            results.append(record)
            if len(results) >= 500:  # hard cap on returned rows
                break
        return {"columns": [str(c) for c in columns], "rows": results}

    def __len__(self) -> int:  # pragma: no cover - trivial
        return len(self._store)
