"""Request/response schemas for the TASK-004 authoring endpoints (Law 13:
every request body is validated with a schema adjacent to its route, never
cast from untrusted input).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class NlAuthoringRequest(BaseModel):
    """AC-004-01: free-text modeller intent, plus the existing class IRIs
    (IRI -> label) so the model can resolve references instead of creating
    duplicates.
    """

    text: str = Field(min_length=1, max_length=2000)
    known_class_iris: dict[str, str] = Field(default_factory=dict)


class RestrictionRequest(BaseModel):
    """AC-004-06/-07: a single restriction directive. `restriction_type`
    discriminates which of the two op-builder branches runs; the fields
    each branch needs are optional here and cross-validated below so one
    schema covers both without a discriminated union of near-identical
    single-field models.
    """

    restriction_type: Literal["min_cardinality", "disjoint_with"]
    class_iri: str | None = Field(default=None, min_length=1)
    property_iri: str | None = Field(default=None, min_length=1)
    min_count: int | None = Field(default=None, ge=0)
    existing_max_count: int | None = Field(default=None, ge=0)
    class_a_iri: str | None = Field(default=None, min_length=1)
    class_b_iri: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def _check_required_fields(self) -> RestrictionRequest:
        if self.restriction_type == "min_cardinality":
            missing = self.class_iri is None or self.property_iri is None or self.min_count is None
            if missing:
                raise ValueError(
                    "min_cardinality requires class_iri, property_iri, min_count"
                )
        else:
            if self.class_a_iri is None or self.class_b_iri is None:
                raise ValueError("disjoint_with requires class_a_iri, class_b_iri")
        return self


class ImportRequest(BaseModel):
    """AC-004-10/-11: `on_collision` is `None` on the first call -- if the
    plan finds collisions, the caller must resubmit with an explicit
    decision (never silently resolved).
    """

    turtle: str = Field(min_length=1)
    existing_class_iris: list[str] = Field(default_factory=list)
    on_collision: Literal["skip", "overwrite"] | None = None


class ImportCollisionResponse(BaseModel):
    collision_iris: list[str]


class ImportResult(BaseModel):
    """AC-004-12: modeller-facing report of what an import batch committed."""

    classes_added: int
    properties_added: int
    relationships_added: int
    unknown_kinds: list[str]
    version_iri: str | None
