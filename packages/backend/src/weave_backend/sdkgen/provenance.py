"""BE-V1-TASK-005 (BE-SDK-1 delivery, E8-S5/FR-059): BE-ARTEFACT-1
provenance -- entity-IRI collection off the already-built IR (Implementation
Hints: "pass the IR through rather than re-scanning emitted files"), and
stamping every generated file with the same header shape TASK-009's
write-back coordinator emits (`deploy/service.py::_provenance_header`:
spec_id/pinned_version_iri/entity_iris), per-language comment syntax.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from weave_backend.projects.model import Project
from weave_backend.sdkgen.ir import SdkModel

_PROVENANCE_FILE = "PROVENANCE.json"

#: AC-5: per-language one-line comment syntax for the files the three
#: emitters write (`.ts`/`.py`/`.yaml` -- `emit_openapi` writes YAML).
_COMMENT_PREFIX = {".ts": "//", ".py": "#", ".yaml": "#", ".yml": "#"}


def collect_iris(ir: SdkModel) -> list[str]:
    """Every entity IRI the built SDK references -- classes + functions
    (AC-5). `IRQuery` carries no IRI of its own (named-select results are
    untyped rows, not graph entities), so it's not walked here.
    """
    return [c.iri for c in ir.classes] + [fn.fn_iri for fn in ir.functions]


def build_sdk_provenance_header(project: Project, entity_iris: list[str]) -> dict[str, Any]:
    """Same three fields as `deploy/service.py::_provenance_header`
    (spec_id/pinned_version_iri/entity_iris) -- `spec_id` is the project's
    own IRI here (an SDK generation has no task brief to cite, unlike the
    write-back coordinator's `task_id`).
    """
    return {
        "spec_id": project.project_iri,
        "pinned_version_iri": project.pinned_graph_version_iri,
        "entity_iris": entity_iris,
    }


def stamp_provenance(staging: Path, header: dict[str, Any]) -> None:
    """AC-5: "stamp every generated file with the BE-ARTEFACT-1 provenance
    header" -- the full header lives once in `PROVENANCE.json` at the
    staging root (JSON has no comment syntax to embed it directly, and
    `entity_iris` can be long), and every `.ts`/`.py`/`.yaml` file gets a
    one-line comment pointing back at it.
    """
    (staging / _PROVENANCE_FILE).write_text(json.dumps(header, indent=2))
    for path in staging.rglob("*"):
        prefix = _COMMENT_PREFIX.get(path.suffix)
        if not path.is_file() or prefix is None:
            continue
        note = f"{prefix} weave-provenance: see {_PROVENANCE_FILE}\n"
        path.write_text(note + path.read_text())
