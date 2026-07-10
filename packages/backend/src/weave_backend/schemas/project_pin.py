"""Request/response schemas for TASK-016 (FR-012, CE-DIFF-1 diff + explicit
confirm) -- `routers/project_pin.py`. Reuses CE-DIFF-1's `TripleModel`/
`ModificationModel` shapes (`schemas/ontology.py`) rather than redefining
them.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from weave_backend.schemas.ontology import ModificationModel, TripleModel


class PinBreakingVersion(BaseModel):
    """One entry of CE-DIFF-1's `versions` breaking-span. Not yet emitted by
    CE's own `DiffResponse` (see `schemas/ontology.py`) -- Build passes this
    through verbatim per contracts.md and never derives it itself.
    """

    version_iri: str
    breaking: bool


class PinDiffResponse(BaseModel):
    from_version_iri: str
    to_version_iri: str
    added: list[TripleModel]
    removed: list[TripleModel]
    modified: list[ModificationModel]
    versions: list[PinBreakingVersion] = Field(default_factory=list)


class PinUpgradeRequest(BaseModel):
    #: AC-3: re-verified against a freshly-fetched CE-VERSION-1 latest
    #: server-side -- never trusted from the client alone.
    confirm_version_iri: str


class PinUpgradeResponse(BaseModel):
    pinned_graph_version_iri: str
