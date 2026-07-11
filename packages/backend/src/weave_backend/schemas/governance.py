"""Request/response schemas for the TASK-005 governance-shapes endpoints
(Law 13: every request body is validated with a schema adjacent to its
route, never cast from untrusted input).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ShapeRulePreviewRequest(BaseModel):
    """AC-005-01: free-text compliance rule description. Preview-only --
    never committed by this request alone (see `ShapeRuleCommitRequest`).
    """

    text: str = Field(min_length=1, max_length=2000)


class ShapeRulePreviewResponse(BaseModel):
    """The AI-generated candidate shape, shown to the compliance officer
    for review before they approve it.
    """

    shape_turtle: str


class ShapeRuleCommitRequest(BaseModel):
    """AC-005-01/-05: the human-approved shape Turtle -- either the
    unedited `shape_turtle` from a preview response, a hand-edited version
    of it, or hand-authored Turtle submitted directly (the raw-SHACL
    editing path, always live regardless of AI availability).
    """

    shape_turtle: str = Field(min_length=1)
    #: Caller-asserted, like `ApplyRequest.actor` -- descriptive PROV-O
    #: attribution only, never trusted authorization. True when this
    #: Turtle originated from `POST /rules/preview`'s AI generation.
    ai_generated: bool = False


class ShapeRuleCommitResponse(BaseModel):
    shape_iri: str
    activity_iri: str
