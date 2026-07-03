"""Law 13: response schema for `GET /api/search`. `q`/`workspace_id` are
plain query params validated via FastAPI `Query()` constraints directly on
the route (there is no request body on a GET) -- see `routers/search.py`.
"""

from __future__ import annotations

from pydantic import BaseModel


class SearchResult(BaseModel):
    iri: str
    label: str
    kind: str


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
