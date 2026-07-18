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


class ModelTierInfo(BaseModel):
    """G13: one PDAC tier's current selection + the full validated allow-list."""

    selected: str
    allowed: list[str]


class ModelsSettingsResponse(BaseModel):
    #: keyed by the real internal tier name (`fable`/`sonnet` --
    #: `ai/config.py::MODEL_ROUTING_TABLE`), not a fixed literal set, so a
    #: future tier rename/addition needs no schema change here.
    tiers: dict[str, ModelTierInfo]


class SetModelSettingsRequest(BaseModel):
    tier: str = Field(min_length=1)
    model: str = Field(min_length=1)
