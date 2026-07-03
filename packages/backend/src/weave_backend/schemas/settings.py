"""Law 13: request-body schema for the settings write route."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SetSettingRequest(BaseModel):
    scope_iri: str = Field(min_length=1)
    value: Any


class ResolvedSettingResponse(BaseModel):
    key: str
    value: Any
    resolved_at: str
    resolved_from_iri: str


class SetSettingResponse(BaseModel):
    key: str
    scope_iri: str
    value: Any
