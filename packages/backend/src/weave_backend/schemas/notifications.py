"""Law 13: request/response schemas for the notification centre + preferences
routes (PLAT-NOTIFY-1). `event_type` is deliberately a plain `str` everywhere
here -- the open taxonomy is a first-class contract, not just an
implementation detail of the store layer.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: str
    event_type: str
    payload: dict[str, Any]
    delivered_channels: list[str]
    read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationOut]
    total: int
    page: int
    per_page: int


class PreferencesUpdateRequest(BaseModel):
    event_type: str = Field(min_length=1)
    channels: list[str] = Field(min_length=1)


class PreferencesUpdateResponse(BaseModel):
    saved: bool


class MarkReadResponse(BaseModel):
    id: str
    read: bool


class PreferenceTypeOut(BaseModel):
    """TASK-030 AC-4: one row of the Settings -> Notifications matrix. Email
    is always disabled/locked -- `PLAT-NOTIFY-1`'s "post-v1" channel, never
    hidden (contracts.md).
    """

    event_type: str
    group: str
    in_app_enabled: bool
    email_enabled: bool = False
    email_locked_post_v1: bool = True


class PreferencesResponse(BaseModel):
    types: list[PreferenceTypeOut]
