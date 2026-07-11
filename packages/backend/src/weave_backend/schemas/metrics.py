"""Wire DTO for CE-METRICS-1 (`GET /api/metrics/ontology`, contracts.md).

`entity_count_by_kind` is keyed by BPMO kind LABEL (e.g. "Process") -- the
same human-readable label `GET /api/ontology/types` serves, not the kind
IRI. Platform's dashboard tiles render this key directly.

`shacl_errors_by_severity` and `owl_inconsistencies` always serve
`{"pending": true}` in v1: SHACL report persistence (TASK-006) and the OWL
reasoner (post-v1 EPIC-008) have no producer yet -- honesty rule, never
zeros (TASK-006 AC-006-04 / TASK-007 AC-007-03).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class PendingMarker(BaseModel):
    pending: Literal[True] = True


class DraftPublishedDelta(BaseModel):
    added: int
    removed: int
    modified: int


class MetricsResponse(BaseModel):
    entity_count_by_kind: dict[str, int]
    latest_version: str | None
    draft_published_delta: DraftPublishedDelta
    shacl_errors_by_severity: PendingMarker
    owl_inconsistencies: PendingMarker
