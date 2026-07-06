"""Law 13: `POST /api/layout/positions` body schema.

Fields are loosely typed (``Any``) by design -- the task brief's own
pseudocode manually ``isinstance``-checks ``position_x``/``position_y`` and
validates ``node_iri`` as an absolute IRI *after* parsing (see
``routers/layout.py``), rather than relying on pydantic's automatic
type-coercion 422 (which nests the error under FastAPI's default ``detail``
key and cannot produce this task's mandated flat ``{"error": ...}`` body).
``extra="allow"`` lets an unexpected ``locked`` field survive parsing so the
route can reject it explicitly with the brief's own error code, instead of
pydantic silently dropping it or raising its own (nested) 422.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class LayoutSaveRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    graph_id: Any = None
    node_iri: Any = None
    position_x: Any = None
    position_y: Any = None
    workspace_id: str | None = None
    #: Defense-in-depth field (AC-6): compared against the JWT's tenant_id
    #: claim, never trusted alone -- see testing-strategy.md's example test.
    tenant_id: str | None = None


class LayoutPositionOut(BaseModel):
    node_iri: str
    position_x: float
    position_y: float
    locked: bool


class LayoutPositionsResponse(BaseModel):
    positions: list[LayoutPositionOut]
