"""Law 13: response DTOs for `GET /api/projects/{id}/decisions` (TASK-020).
`kind` is Build-computed (`audit.decisions.classify_kind`) -- it does not
exist on the PLAT-AUDIT-1 event shape itself (AC-7). No request-body schema:
this route is read-only, all inputs are query params validated inline by
the router's own `Literal`/`Query` types.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class DecisionEntryResponse(BaseModel):
    seq: int
    ts: str
    actor_principal_iri: str
    event_type: str
    target_iri: str
    diff_summary: dict[str, Any] | None
    kind: Literal["decision", "task_update", "system"]


class DecisionPageResponse(BaseModel):
    entries: list[DecisionEntryResponse]
    next_cursor: int | None
