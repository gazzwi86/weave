"""Law 13: response schemas for CE-BRAND-1 (`GET /api/brand/tokens`,
`GET /api/brand/voice-rules`). Both routes are read-only (no request body);
`version`/`workspace_id` are plain query params validated via FastAPI
`Query()` directly on the route -- see `routers/brand.py`.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class TokensResponse(BaseModel):
    """Closed core (contracts.md CE-BRAND-1, HITL 2026-07-08) + open
    `extensions` pass-through. All five keys are always present, even
    empty -- Build's codegen target must never see a missing key.
    """

    color: dict[str, Any] = {}
    typography: dict[str, Any] = {}
    spacing: dict[str, Any] = {}
    radius: dict[str, Any] = {}
    extensions: dict[str, Any] = {}


class VoiceRule(BaseModel):
    id: str
    severity: Literal["critical", "normal"]
    assertion: str
