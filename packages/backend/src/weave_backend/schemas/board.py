"""FR-015/016/017 (BE-V1-TASK-017, build-engine EPIC-004):
`GET /api/projects/{project_iri}/board` and
`GET /api/projects/{project_iri}/task-tree` response bodies.
"""

from __future__ import annotations

from pydantic import BaseModel


class BoardCard(BaseModel):
    id: str
    status: str
    lane: str
    #: AC-2: E6-S3 failure class + per-class ceiling state, joined from the
    #: ephemeral task store (`build/board.py`'s `_retry_info`) -- `None`
    #: when the task has never failed (or the process-local store has no
    #: record of it, e.g. after a restart).
    failure_class: str | None = None
    retry_attempt: int | None = None
    retry_ceiling: int | None = None
    #: AC-2: a ceiling-hit task is never silently shown as still running.
    hitl_escalated: bool = False


class BoardResponse(BaseModel):
    project_iri: str
    lanes: list[str]
    cards: list[BoardCard]


class TaskTreeNode(BaseModel):
    id: str
    status: str
    blocked_by: list[str]
    #: AC-3: True for a synthesized stub node standing in for a
    #: `blocked_by` id with no matching task in the spine.
    missing: bool = False


class TaskTreeResponse(BaseModel):
    project_iri: str
    nodes: list[TaskTreeNode]
