"""BE-TASK-002: the ``TaskBrief`` document schema (FR-018 AC-1/AC-2).

Pydantic v2 contract for the Architect agent's drafted brief. Raw LLM
output is never persisted or handed to an engineer lane directly -- it is
always passed through ``TaskBrief.model_validate()`` first (task brief's
Implementation Hints).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class EarsAC(BaseModel):
    """One EARS-worded ("WHEN ... THE SYSTEM SHALL ...") acceptance
    criterion.
    """

    id: str
    criterion: str
    test_mapping: str

    @field_validator("criterion", mode="before")
    @classmethod
    def _must_be_ears_worded(cls, value: object) -> object:
        if not isinstance(value, str) or "WHEN" not in value.upper():
            raise ValueError("acceptance criterion must be EARS-worded (contain WHEN)")
        return value


class AcToTestMapping(BaseModel):
    ac_id: str
    test_name: str


class DepChain(BaseModel):
    blocked_by: list[str] = Field(default_factory=list)
    unlocks: list[str] = Field(default_factory=list)


class CostEstimate(BaseModel):
    complexity: Literal["S", "M", "L", "XL"]
    estimated_tokens_input_k: float
    estimated_tokens_output_k: float
    estimated_cost_usd: float


class TaskBrief(BaseModel):
    """The persisted task-brief document (AC-1). ``design_tokens`` is
    optional -- only design-bearing tasks carry it.
    """

    schema_version: str
    task_id: str
    project_iri: str
    title: str
    user_story: str
    acceptance_criteria: list[EarsAC] = Field(min_length=1)
    ac_to_test_map: list[AcToTestMapping]
    dor_checklist: list[str]
    dod_checklist: list[str]
    dep_chain: DepChain
    cost_estimate: CostEstimate
    generated_at: datetime
    design_tokens: dict[str, object] | None = None
    #: BE-V1-TASK-018 AC-6: ADR/decision references the brief links (e.g.
    #: "ADR-017") -- optional, additive field (no migration: `content` is
    #: JSONB). Task Detail's Brief tab resolves each entry to a Decision
    #: Log record via `audit.decisions`.
    adr_refs: list[str] = Field(default_factory=list)
    #: G9 (docs/design/remediation-2-api-gaps.md): no epic entity exists in
    #: the DB -- same additive-JSONB-field precedent as `adr_refs`. The
    #: epic rollup (`build.epics`) groups tasks by `epic_id`, falling back
    #: to an "unassigned" bucket when absent.
    epic_id: str | None = None
    epic_title: str | None = None

    @model_validator(mode="after")
    def _every_ac_is_test_mapped(self) -> TaskBrief:
        mapped_ids = {mapping.ac_id for mapping in self.ac_to_test_map}
        missing = [ac.id for ac in self.acceptance_criteria if ac.id not in mapped_ids]
        if missing:
            raise ValueError(
                f"acceptance criteria missing from ac_to_test_map: {', '.join(missing)}"
            )
        return self
