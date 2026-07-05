"""Law 13: request/response schemas for `POST /api/query/nl` (AC-007-01)
and `POST /api/query/explain` (AC-007-14).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class NlQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    workspace_id: str | None = None
    #: AC-006: defaults to the newest *published* version (never a draft --
    #: drafts stay mutable). Matches `GET /api/sparql`'s own `version` param.
    version: str = "latest"
    #: AC-007-03: 1-indexed page of `_PAGE_SIZE` rows -- mirrors
    #: `GET /api/sparql`'s pagination, adapted to a POST body since there is
    #: no query-string page to bump.
    page: int = Field(default=1, ge=1)


class NlQueryResponse(BaseModel):
    sparql_generated: str
    rows: list[dict[str, str]]
    column_names: list[str]
    elapsed_ms: float
    #: AC-007-04: populated only when `rows` is empty -- a plain-language
    #: reason instead of a bare empty result.
    explanation: str | None = None
    #: AC-007-03: the next page number to request, or None if this is the
    #: last page.
    next_page: int | None = None


class ExplainQueryRequest(BaseModel):
    sparql: str = Field(min_length=1)


class ExplainQueryResponse(BaseModel):
    explanation: str
