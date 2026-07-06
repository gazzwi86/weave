"""AC-005-03: humanises a CE-WRITE-1 `ViolationDetail` for the guided-form
flow -- maps the raw `sh:resultPath` predicate IRI to the same human
`sh:name` the shape already carries, surfaced live via
`ontology/catalogue.py::list_kinds` (never a hand-maintained IRI->name
table -- `.claude/rules/ontology-standards.md`). Deliberately does not
touch the shared `schemas/operations.py::ViolationDetail`/`ViolationsResponse`
models: this is a local, instances-router-only response shape built on top.
"""

from __future__ import annotations

from weave_backend.ontology.catalogue import list_kinds
from weave_backend.schemas.operations import ViolationDetail


def _local_name(iri: str) -> str:
    return iri.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def _field_name_index() -> dict[str, str]:
    return {prop.path: prop.name for kind in list_kinds() for prop in kind.properties}


def humanize_violation(violation: ViolationDetail, field_names: dict[str, str]) -> dict[str, str]:
    if violation.path is None:
        field = ""
    else:
        field = field_names.get(violation.path, _local_name(violation.path))
    return {
        "field": field,
        "path": violation.path or "",
        "severity": violation.severity,
        "message": violation.message,
    }


def humanize_violations(violations: list[ViolationDetail]) -> list[dict[str, str]]:
    field_names = _field_name_index()
    return [humanize_violation(v, field_names) for v in violations]
