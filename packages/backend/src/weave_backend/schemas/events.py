"""Response schema for CE-EVENT-1 beta transport (`routers/events.py`)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ChangeType = Literal["added", "updated", "deleted", "constraint-violated"]


class EventEntry(BaseModel):
    seq: int
    change_type: ChangeType
    entity_iri: str
    version_iri: str | None
    last_published_version: str | None
    actor: str
    ts: datetime


class EventsResponse(BaseModel):
    events: list[EventEntry]
    latest_seq: int


class EventsQueryParams(BaseModel):
    """Validates the `GET /api/events` query string (Law 13)."""

    since_seq: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=500)
