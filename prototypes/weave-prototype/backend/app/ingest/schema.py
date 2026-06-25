"""Parse uploaded schemas into a flat field list, then materialise nodes.

Following the research (CSVW/DCAT, ADR-013): a schema becomes one ``DataAsset``
node with one ``Field`` node per column/property (``weave:partOf`` the asset),
each carrying an inferred ``xsd`` datatype. The physical asset stays distinct
from any concept it ``describes``.
"""

from __future__ import annotations

import csv
import io
import json
import re
from typing import Any

from ..ontology import OntologyStore

CSV = "csv"
JSON_SCHEMA = "json_schema"
SUPPORTED_FORMATS = (CSV, JSON_SCHEMA)

# JSON Schema primitive type -> xsd local name.
_JSON_XSD = {
    "integer": "integer",
    "number": "decimal",
    "boolean": "boolean",
    "string": "string",
    "object": "string",
    "array": "string",
}

_INT_RE = re.compile(r"-?\d+")
_DEC_RE = re.compile(r"-?\d*\.\d+")
_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


def _infer_xsd(value: str) -> str:
    """Guess an xsd datatype from a sample CSV cell."""
    v = value.strip()
    if v == "":
        return "string"
    if _INT_RE.fullmatch(v):
        return "integer"
    if _DEC_RE.fullmatch(v):
        return "decimal"
    if v.lower() in ("true", "false"):
        return "boolean"
    if _DATE_RE.fullmatch(v):
        return "date"
    return "string"


def _parse_csv(content: str) -> list[dict[str, str]]:
    rows = list(csv.reader(io.StringIO(content)))
    if not rows:
        return []
    headers = rows[0]
    sample = rows[1] if len(rows) > 1 else []
    fields = []
    for i, header in enumerate(headers):
        xsd = _infer_xsd(sample[i]) if i < len(sample) else "string"
        fields.append({"name": header.strip() or f"column_{i + 1}", "type": xsd})
    return fields


def _json_field_type(spec: Any) -> str:
    if not isinstance(spec, dict):
        return "string"
    declared = spec.get("type")
    if isinstance(declared, list):
        declared = next((t for t in declared if isinstance(t, str) and t != "null"), None)
    return _JSON_XSD.get(declared, "string") if isinstance(declared, str) else "string"


def _parse_json_schema(content: str) -> list[dict[str, str]]:
    data = json.loads(content)
    properties = data.get("properties", {}) if isinstance(data, dict) else {}
    return [{"name": name, "type": _json_field_type(spec)} for name, spec in properties.items()]


def parse_schema(fmt: str, content: str) -> list[dict[str, str]]:
    """Parse schema text into ``[{name, type}]``; raises ValueError on bad input."""
    if fmt == CSV:
        return _parse_csv(content)
    if fmt == JSON_SCHEMA:
        return _parse_json_schema(content)
    raise ValueError(f"Unsupported schema format: {fmt!r} (expected one of {SUPPORTED_FORMATS})")


def import_schema(
    store: OntologyStore,
    name: str,
    fmt: str,
    content: str,
    concept: str | None = None,
) -> dict[str, Any]:
    """Create a DataAsset + Field nodes for a schema; link to a concept if given."""
    fields = parse_schema(fmt, content)
    asset_id = store.add_node(
        {
            "label": name,
            "kind": "DataAsset",
            "comment": f"Imported {fmt} schema with {len(fields)} field(s).",
        }
    )
    field_ids = []
    for field in fields:
        field_id = store.add_node(
            {"label": field["name"], "kind": "Field", "note": f"xsd:{field['type']}"}
        )
        store.add_edge({"source": field_id, "target": asset_id, "type": "partOf"})
        field_ids.append(field_id)
    if concept:
        store.add_edge({"source": asset_id, "target": concept, "type": "describes"})
    return {"asset_id": asset_id, "field_ids": field_ids}
