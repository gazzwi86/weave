"""Law 13: `/api/views*` body schemas. `ViewCreateRequest` follows
`schemas/layout.py`'s loosely-typed (`Any`) pattern -- the task brief's
pseudocode manually branches on "no name" (400) vs. "bad definition" (422),
two distinct error codes pydantic's own type-coercion 422 can't produce.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ViewPositionIn(BaseModel):
    node_iri: str
    position_x: float
    position_y: float


class ViewCreateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: Any = None
    definition: Any = None
    #: current canvas drag-state, client-supplied (never read back from the
    #: layout table -- see the task brief's implementation hint).
    positions: list[ViewPositionIn] = Field(default_factory=list)
    overwrite: bool = False


class ViewOut(BaseModel):
    view_id: str
    name: str
    created_by: str
    pinned: bool
    updated_at: datetime


class ShareRequest(BaseModel):
    recipients: list[str] = Field(default_factory=list)


class ShareResponse(BaseModel):
    notified: int
    excluded: int


class PinRequest(BaseModel):
    pinned: bool
