"""DB access for onboarding per-(tenant, user) progress state (ADR-003).
Every query is tenant + user scoped; RLS (migrations/0082_onboarding_state.sql)
is the belt-and-braces backstop, same pattern as notifications/settings.

``exercise_completion``/``activation`` are read-only here -- this task's
routes never write them (the milestone recorder is TASK-011, exercise
verification is a later task); this module only proves the tables exist,
carry RLS, and are aggregated into the bootstrap read.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

import asyncpg
from pydantic import BaseModel

RolePath = Literal["business", "technical", "compliance", "admin"]
PathVariant = Literal["default", "read_only"]
DismissalKind = Literal["beacon", "welcome_modal"]

_DEFAULT_ROLE_PATH: RolePath = "business"
_DEFAULT_PATH_VARIANT: PathVariant = "default"


class TourProgressRecord(BaseModel):
    tour_id: str
    last_completed_step: int
    completed_at: datetime | None
    skipped_at: datetime | None


class DismissalRecord(BaseModel):
    kind: str
    ref_id: str
    dismissed_at: datetime


class ExerciseCompletionRecord(BaseModel):
    exercise_id: str
    verified_signal: str
    completed_at: datetime


class ActivationRecord(BaseModel):
    milestone_id: str
    source: str
    activated_at: datetime


class OnboardingStateRecord(BaseModel):
    role_path: RolePath
    path_variant: PathVariant
    path_chosen_manually: bool
    checklist_dismissed_at: datetime | None
    checklist_completed_at: datetime | None
    whats_new_seen_at: datetime | None
    #: TASK-010 AC-010-02: exposed so the checklist widget can derive the
    #: "visit demo" item (`sandbox_workspace_id IS NOT NULL` *is* the visit,
    #: per the brief's implementation hint) without a second round-trip.
    sandbox_workspace_id: str | None
    sandbox_forked_at: datetime | None
    tours: list[TourProgressRecord]
    dismissals: list[DismissalRecord]
    exercise_completions: list[ExerciseCompletionRecord]
    activations: list[ActivationRecord]


@dataclass(frozen=True)
class StatePatch:
    """AC-001-05: `None` means "leave unchanged" -- a PATCH can't currently
    distinguish "field omitted" from "field explicitly cleared to null" for
    the two nullable timestamp fields; no route in this task's scope needs
    to clear them back to null, so this is an accepted limitation, not a gap.
    TASK-010: restoring a dismissed checklist is the one case that *does*
    need a real clear -- that goes through `clear_checklist_dismissal`
    below instead of widening this COALESCE contract.
    """

    role_path: RolePath | None = None
    path_variant: PathVariant | None = None
    path_chosen_manually: bool | None = None
    checklist_dismissed_at: datetime | None = None
    #: TASK-010 AC-010-04: widget-set once all items complete, feeds the
    #: auto-dismiss window arithmetic client-side.
    checklist_completed_at: datetime | None = None
    whats_new_seen_at: datetime | None = None


@dataclass(frozen=True)
class TourProgressPatch:
    last_completed_step: int
    completed: bool = False
    skipped: bool = False


async def get_state(
    conn: asyncpg.Connection, *, tenant_id: str, user_id: str
) -> OnboardingStateRecord:
    """AC-001-04: side-effect-free bootstrap read -- a brand-new user (no
    spine row yet) gets a well-formed default response, not a 404, since
    this is the SPA's every-screen bootstrap call. Row creation happens
    lazily on the first ``patch_state`` call, never here.
    """
    spine = await conn.fetchrow(
        "SELECT role_path, path_variant, path_chosen_manually, checklist_dismissed_at,"
        " checklist_completed_at, whats_new_seen_at, sandbox_workspace_id, sandbox_forked_at"
        " FROM onboarding_state WHERE tenant_id = $1 AND user_id = $2",
        tenant_id,
        user_id,
    )
    tours = await conn.fetch(
        "SELECT tour_id, last_completed_step, completed_at, skipped_at FROM tour_progress"
        " WHERE tenant_id = $1 AND user_id = $2",
        tenant_id,
        user_id,
    )
    dismissals = await conn.fetch(
        "SELECT kind, ref_id, dismissed_at FROM dismissal WHERE tenant_id = $1 AND user_id = $2",
        tenant_id,
        user_id,
    )
    exercises = await conn.fetch(
        "SELECT exercise_id, verified_signal, completed_at FROM exercise_completion"
        " WHERE tenant_id = $1 AND user_id = $2",
        tenant_id,
        user_id,
    )
    activations = await conn.fetch(
        "SELECT milestone_id, source, activated_at FROM activation"
        " WHERE tenant_id = $1 AND user_id = $2",
        tenant_id,
        user_id,
    )
    return _assemble_state(spine, tours, dismissals, exercises, activations)


def _assemble_state(
    spine: Any,
    tours: list[Any],
    dismissals: list[Any],
    exercises: list[Any],
    activations: list[Any],
) -> OnboardingStateRecord:
    return OnboardingStateRecord(
        role_path=spine["role_path"] if spine else _DEFAULT_ROLE_PATH,
        path_variant=spine["path_variant"] if spine else _DEFAULT_PATH_VARIANT,
        path_chosen_manually=spine["path_chosen_manually"] if spine else False,
        checklist_dismissed_at=spine["checklist_dismissed_at"] if spine else None,
        checklist_completed_at=spine["checklist_completed_at"] if spine else None,
        whats_new_seen_at=spine["whats_new_seen_at"] if spine else None,
        sandbox_workspace_id=spine["sandbox_workspace_id"] if spine else None,
        sandbox_forked_at=spine["sandbox_forked_at"] if spine else None,
        tours=[TourProgressRecord(**row) for row in tours],
        dismissals=[DismissalRecord(**row) for row in dismissals],
        exercise_completions=[ExerciseCompletionRecord(**row) for row in exercises],
        activations=[ActivationRecord(**row) for row in activations],
    )


async def patch_state(
    conn: asyncpg.Connection, *, tenant_id: str, user_id: str, patch: StatePatch
) -> None:
    """AC-001-05: partial update -- only provided fields change. A first-ever
    call lazily creates the spine row (``get_state`` never does).
    """
    await conn.execute(
        """
        INSERT INTO onboarding_state
            (tenant_id, user_id, role_path, path_variant, path_chosen_manually,
             checklist_dismissed_at, checklist_completed_at, whats_new_seen_at,
             created_at, updated_at)
        VALUES ($1, $2, COALESCE($3, 'business'), COALESCE($4, 'default'),
                COALESCE($5, false), $6, $7, $8, now(), now())
        ON CONFLICT (tenant_id, user_id) DO UPDATE SET
            role_path = COALESCE($3, onboarding_state.role_path),
            path_variant = COALESCE($4, onboarding_state.path_variant),
            path_chosen_manually = COALESCE($5, onboarding_state.path_chosen_manually),
            checklist_dismissed_at = COALESCE($6, onboarding_state.checklist_dismissed_at),
            checklist_completed_at = COALESCE($7, onboarding_state.checklist_completed_at),
            whats_new_seen_at = COALESCE($8, onboarding_state.whats_new_seen_at),
            updated_at = now()
        """,
        tenant_id,
        user_id,
        patch.role_path,
        patch.path_variant,
        patch.path_chosen_manually,
        patch.checklist_dismissed_at,
        patch.checklist_completed_at,
        patch.whats_new_seen_at,
    )


async def clear_checklist_dismissal(
    conn: asyncpg.Connection, *, tenant_id: str, user_id: str
) -> None:
    """TASK-010 AC-010-05: restore -- `patch_state`'s COALESCE contract
    can't null a field back out (see `StatePatch`'s docstring), so restore
    gets its own direct UPDATE rather than widening that contract. A no-op
    if the spine row doesn't exist yet (nothing to restore).
    """
    await conn.execute(
        "UPDATE onboarding_state SET checklist_dismissed_at = NULL, updated_at = now()"
        " WHERE tenant_id = $1 AND user_id = $2",
        tenant_id,
        user_id,
    )


async def get_sandbox_workspace_id(
    conn: asyncpg.Connection, *, tenant_id: str, user_id: str
) -> str | None:
    """TASK-004: read-side of the sandbox pointer (`onboarding_state.
    sandbox_workspace_id`, TASK-001's migration). `None` means "never
    forked" -- a brand-new user's row may not exist at all yet.
    """
    row = await conn.fetchrow(
        "SELECT sandbox_workspace_id FROM onboarding_state WHERE tenant_id = $1 AND user_id = $2",
        tenant_id,
        user_id,
    )
    if row is None or row["sandbox_workspace_id"] is None:
        return None
    return str(row["sandbox_workspace_id"])


async def set_sandbox_pointer(
    conn: asyncpg.Connection, *, tenant_id: str, user_id: str, workspace_id: str, semver: str
) -> None:
    """AC-004-03: write-side of the sandbox pointer -- callers must only
    invoke this AFTER a fork has fully applied and published (pointer-last
    is what makes "never present a half-seeded sandbox" trivial: nothing
    upstream of this call can leave a partial fork visible, because nothing
    upstream writes to `onboarding_state` at all).
    """
    await conn.execute(
        """
        INSERT INTO onboarding_state
            (tenant_id, user_id, sandbox_workspace_id, sandbox_batch_semver, sandbox_forked_at,
             created_at, updated_at)
        VALUES ($1, $2, $3, $4, now(), now(), now())
        ON CONFLICT (tenant_id, user_id) DO UPDATE SET
            sandbox_workspace_id = $3,
            sandbox_batch_semver = $4,
            sandbox_forked_at = now(),
            updated_at = now()
        """,
        tenant_id,
        user_id,
        workspace_id,
        semver,
    )


async def swap_sandbox_pointer(
    conn: asyncpg.Connection, *, tenant_id: str, user_id: str, workspace_id: str, semver: str
) -> None:
    """TASK-005 AC-005-02/03: reset's atomic swap -- pointer flip and
    ``exercise_completion`` clear happen in the caller's single open
    transaction (`tenant_connection` already wraps one), so there is never a
    window where the new pointer is visible with stale exercise flags still
    attached. ``activation`` rows are never touched here (ADR-003).
    """
    await set_sandbox_pointer(
        conn, tenant_id=tenant_id, user_id=user_id, workspace_id=workspace_id, semver=semver
    )
    await conn.execute(
        "DELETE FROM exercise_completion WHERE tenant_id = $1 AND user_id = $2",
        tenant_id,
        user_id,
    )


async def upsert_tour_progress(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    user_id: str,
    tour_id: str,
    patch: TourProgressPatch,
) -> None:
    """AC-001-05: resume-point persistence. Skipping a tour still writes
    ``skipped_at`` but never resets ``last_completed_step`` -- the caller
    always sends the current step, so this is a plain upsert, not special
    skip logic (data-model.md's "skip preserves last_completed_step" note).
    """
    await conn.execute(
        """
        INSERT INTO tour_progress
            (tenant_id, user_id, tour_id, last_completed_step, completed_at, skipped_at,
             updated_at)
        VALUES ($1, $2, $3, $4,
                CASE WHEN $5 THEN now() ELSE NULL END,
                CASE WHEN $6 THEN now() ELSE NULL END,
                now())
        ON CONFLICT (tenant_id, user_id, tour_id) DO UPDATE SET
            last_completed_step = $4,
            completed_at = CASE WHEN $5 THEN now() ELSE tour_progress.completed_at END,
            skipped_at = CASE WHEN $6 THEN now() ELSE tour_progress.skipped_at END,
            updated_at = now()
        """,
        tenant_id,
        user_id,
        tour_id,
        patch.last_completed_step,
        patch.completed,
        patch.skipped,
    )


async def upsert_dismissal(
    conn: asyncpg.Connection, *, tenant_id: str, user_id: str, kind: DismissalKind, ref_id: str
) -> None:
    await conn.execute(
        """
        INSERT INTO dismissal (tenant_id, user_id, kind, ref_id, dismissed_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (tenant_id, user_id, kind, ref_id) DO UPDATE SET dismissed_at = now()
        """,
        tenant_id,
        user_id,
        kind,
        ref_id,
    )


async def delete_dismissal(
    conn: asyncpg.Connection, *, tenant_id: str, user_id: str, kind: DismissalKind, ref_id: str
) -> bool:
    result: str = await conn.execute(
        "DELETE FROM dismissal WHERE tenant_id = $1 AND user_id = $2 AND kind = $3 AND ref_id = $4",
        tenant_id,
        user_id,
        kind,
        ref_id,
    )
    return result == "DELETE 1"


async def delete_beacon_dismissals(
    conn: asyncpg.Connection, *, tenant_id: str, user_id: str
) -> int:
    """ "Show all hints": bulk-clears every `beacon` dismissal, never a
    `welcome_modal` row (data-model.md's table notes).
    """
    result = await conn.execute(
        "DELETE FROM dismissal WHERE tenant_id = $1 AND user_id = $2 AND kind = 'beacon'",
        tenant_id,
        user_id,
    )
    return int(result.split()[-1])
