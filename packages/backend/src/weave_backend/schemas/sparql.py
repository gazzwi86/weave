"""Law 13: request-body schema for the SPARQL query route."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SparqlQueryRequest(BaseModel):
    query: str = Field(min_length=1)
    workspace_id: str | None = None
