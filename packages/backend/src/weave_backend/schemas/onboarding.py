"""Law 13: request/response schemas for `/api/onboarding/*` (ONB-TASK-001).
`role_path`/`path_variant`/dismissal `kind` are closed vocabularies
(data-model.md's ERD) -- `Literal`, never a plain `str`, so an invalid value
is a 422 at the boundary rather than a store-layer surprise.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

RolePathIn = Literal["business", "technical", "compliance", "admin"]
PathVariantIn = Literal["default", "read_only"]
DismissalKindIn = Literal["beacon", "welcome_modal"]


class OnboardingStatePatchRequest(BaseModel):
    role_path: RolePathIn | None = None
    path_variant: PathVariantIn | None = None
    path_chosen_manually: bool | None = None
    checklist_dismissed_at: datetime | None = None
    checklist_completed_at: datetime | None = None
    whats_new_seen_at: datetime | None = None


class TourProgressRequest(BaseModel):
    last_completed_step: int
    completed: bool = False
    skipped: bool = False


class TourProgressOut(BaseModel):
    tour_id: str
    last_completed_step: int
    completed_at: datetime | None
    skipped_at: datetime | None


class DismissalOut(BaseModel):
    kind: str
    ref_id: str
    dismissed_at: datetime


class ExerciseCompletionOut(BaseModel):
    exercise_id: str
    verified_signal: str
    completed_at: datetime


class ActivationOut(BaseModel):
    milestone_id: str
    source: str
    activated_at: datetime


class OnboardingStateOut(BaseModel):
    role_path: RolePathIn
    path_variant: PathVariantIn
    path_chosen_manually: bool
    checklist_dismissed_at: datetime | None
    checklist_completed_at: datetime | None
    whats_new_seen_at: datetime | None
    sandbox_workspace_id: str | None
    sandbox_forked_at: datetime | None
    #: TASK-010 AC-010-04: resolved 7-day-default settings-cascade tunable
    #: (company -> domain -> project), so the widget's auto-dismiss window
    #: arithmetic is config-driven, not hard-coded (FR-020).
    checklist_auto_dismiss_days: int
    tours: list[TourProgressOut]
    dismissals: list[DismissalOut]
    exercise_completions: list[ExerciseCompletionOut]
    activations: list[ActivationOut]


class SelfMarkResponse(BaseModel):
    marked: bool


class OnboardingPathOut(BaseModel):
    """ONB-TASK-006: resolved/persisted onboarding path. `needs_choice` is
    always False in M1 -- AC-006-02's multi-role prompt is deferred (no
    multi-role source exists yet; see path_resolver.py's module docstring).
    """

    role_path: RolePathIn
    path_variant: PathVariantIn
    path_chosen_manually: bool
    needs_choice: bool


class OnboardingPathChoiceRequest(BaseModel):
    role_path: RolePathIn


class SavedResponse(BaseModel):
    saved: bool


class SandboxOut(BaseModel):
    """TASK-004 AC-004-02: `POST /api/onboarding/sandbox` -- idempotent
    ensure-mine response.
    """

    workspace_id: str
    reused: bool


class DeletedResponse(BaseModel):
    deleted: bool


class BulkDeletedResponse(BaseModel):
    deleted_count: int
