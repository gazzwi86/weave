"""Law 13: `/api/comments*` body schema. `extra="allow"` lets a
client-supplied `author` field survive parsing so the route can reject it
explicitly (AC-6 spoof guard, ADR-019 pattern) instead of pydantic silently
dropping it.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class CommentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    target_kind: Any = None
    target_ref: Any = None
    body: Any = None


class CommentOut(BaseModel):
    comment_id: str
    target_kind: str
    target_ref: str
    author: str
    body: str
    created_at: datetime
