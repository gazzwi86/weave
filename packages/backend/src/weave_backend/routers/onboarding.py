"""ONB-TASK-001: `/api/onboarding/*` -- per-(tenant, user) onboarding
progress state (path, tour resume points, dismissals, checklist, exercise
completions, activations). Same authz shape as notifications: a principal
only ever sees/mutates rows keyed by their own `user_id` -- no route accepts
a client-supplied user id, so `get_current_principal` + RLS is the whole
authz story (AC-001-03: "reject a foreign user id" has no input vector to
build, since one never arrives).
"""

from __future__ import annotations

import logging
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.onboarding import sandbox, store
from weave_backend.onboarding.exercise_checker import (
    UnsupportedCompletionKindError,
    check_completion,
)
from weave_backend.onboarding.exercises import EXERCISES, available_exercises, gate_exercise
from weave_backend.onboarding.hammerbarn_seed.compile import (
    CompiledArtefact,
    allowed_kinds_from_ontology_types,
    compile_seed,
)
from weave_backend.onboarding.milestones import MANUAL_ONLY_MILESTONE_IDS
from weave_backend.onboarding.path_resolver import resolve_role_path
from weave_backend.onboarding.recorder import record_milestone
from weave_backend.ontology.catalogue import list_kinds
from weave_backend.schemas.onboarding import (
    BulkDeletedResponse,
    DeletedResponse,
    DismissalKindIn,
    ExerciseCheckRequest,
    ExerciseCheckResult,
    OnboardingPathChoiceRequest,
    OnboardingPathOut,
    OnboardingStateOut,
    OnboardingStatePatchRequest,
    SandboxOut,
    SandboxResetOut,
    SavedResponse,
    SelfMarkResponse,
    TourProgressRequest,
)
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import company_iri
from weave_backend.tenancy.workspaces import delete_workspace, get_workspace

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

#: AC-010-04: "default 7 days" -- used only when no tenant/domain/project
#: override exists anywhere in the settings cascade.
_DEFAULT_AUTO_DISMISS_DAYS = 7
_AUTO_DISMISS_SETTING_KEY = "onboarding.checklist_auto_dismiss_days"


def _to_out(record: store.OnboardingStateRecord, *, auto_dismiss_days: int) -> OnboardingStateOut:
    return OnboardingStateOut(
        **record.model_dump(),
        checklist_auto_dismiss_days=auto_dismiss_days,
        available_exercises=available_exercises(
            role_path=record.role_path, path_variant=record.path_variant
        ),
    )


async def _resolve_auto_dismiss_days(conn: asyncpg.Connection, *, tenant_id: str) -> int:
    """AC-010-04: company -> domain -> project cascade (PLAT-SETTINGS-1),
    falling back to the documented default when nothing is configured
    anywhere -- config-driven, not hard-coded (FR-020).
    """
    try:
        resolved = await resolve_setting(
            conn,
            tenant_id=tenant_id,
            key=_AUTO_DISMISS_SETTING_KEY,
            context_iri=company_iri(tenant_id),
        )
    except SettingNotFound:
        return _DEFAULT_AUTO_DISMISS_DAYS
    return int(resolved.value)


@router.get("/state", response_model=OnboardingStateOut)
async def get_state_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> OnboardingStateOut:
    async with tenant_connection(principal.tenant_id) as conn:
        record = await store.get_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
        auto_dismiss_days = await _resolve_auto_dismiss_days(conn, tenant_id=principal.tenant_id)
    return _to_out(record, auto_dismiss_days=auto_dismiss_days)


@router.patch("/state", response_model=OnboardingStateOut)
async def patch_state_route(
    body: OnboardingStatePatchRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> OnboardingStateOut:
    patch = store.StatePatch(**body.model_dump())
    async with tenant_connection(principal.tenant_id) as conn:
        await store.patch_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri, patch=patch
        )
        record = await store.get_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
        auto_dismiss_days = await _resolve_auto_dismiss_days(conn, tenant_id=principal.tenant_id)
    return _to_out(record, auto_dismiss_days=auto_dismiss_days)


@router.post("/checklist/restore", response_model=OnboardingStateOut)
async def restore_checklist_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> OnboardingStateOut:
    """AC-010-05: restore -- clears `checklist_dismissed_at` back to null
    (the Help-launcher entry point that calls this is TASK-013's; this task
    only owns the persistence round-trip).
    """
    async with tenant_connection(principal.tenant_id) as conn:
        await store.clear_checklist_dismissal(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
        record = await store.get_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
        auto_dismiss_days = await _resolve_auto_dismiss_days(conn, tenant_id=principal.tenant_id)
    return _to_out(record, auto_dismiss_days=auto_dismiss_days)


@router.post("/milestones/{milestone_id}/self-mark", response_model=SelfMarkResponse)
async def self_mark_milestone_route(
    milestone_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SelfMarkResponse:
    """AC-010-03 / OQ-08: Admin-invite manual self-mark. `milestone_id` is
    checked against an allowlist (not written through free-text) so this
    route can't be used to self-mark a poller-owned milestone. Routes
    through TASK-011's `record_milestone` -- same exactly-once PK, `source
    ="manual"` (idempotent: a second call is a no-op, `marked=False`).
    """
    if milestone_id not in MANUAL_ONLY_MILESTONE_IDS:
        raise HTTPException(status_code=404, detail={"error": "milestone_not_manual"})
    async with tenant_connection(principal.tenant_id) as conn:
        won = await record_milestone(
            conn,
            tenant_id=principal.tenant_id,
            user_id=principal.principal_iri,
            milestone_id=milestone_id,
            source="manual",
        )
    return SelfMarkResponse(marked=won)


def _to_path_out(
    *, role_path: str, path_variant: str, path_chosen_manually: bool
) -> OnboardingPathOut:
    # AC-006-02: needs_choice always False in M1 (no multi-role source yet).
    return OnboardingPathOut(
        role_path=role_path,  # type: ignore[arg-type]
        path_variant=path_variant,  # type: ignore[arg-type]
        path_chosen_manually=path_chosen_manually,
        needs_choice=False,
    )


@router.get("/path", response_model=OnboardingPathOut)
async def get_path_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> OnboardingPathOut:
    """AC-006-01/03/04/06: a manually-chosen path is never re-derived from
    role; otherwise resolve from the caller's workspace role and persist it
    (unless the role source was unreachable -- AC-006-06's fail-safe path).
    """
    async with tenant_connection(principal.tenant_id) as conn:
        record = await store.get_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
        if record.path_chosen_manually:
            return _to_path_out(
                role_path=record.role_path,
                path_variant=record.path_variant,
                path_chosen_manually=True,
            )

        resolved = await resolve_role_path(conn, principal)
        if resolved.persist:
            await store.patch_state(
                conn,
                tenant_id=principal.tenant_id,
                user_id=principal.principal_iri,
                patch=store.StatePatch(
                    role_path=resolved.role_path, path_variant=resolved.path_variant
                ),
            )
    return _to_path_out(
        role_path=resolved.role_path, path_variant=resolved.path_variant, path_chosen_manually=False
    )


def _seed_artefact() -> CompiledArtefact:
    """`compile_seed`'s `allowed_kinds` sourced straight from
    `ontology.catalogue.list_kinds()` -- the same SHACL-backed source CE-
    READ-1's `/api/ontology/types` route reads (compile.py's own docstring)
    -- so no second HTTP hop into this same running app is needed.
    """
    body = {"kinds": [{"iri": kind.iri} for kind in list_kinds()]}
    return compile_seed(allowed_kinds=allowed_kinds_from_ontology_types(body))


@router.post("/sandbox", response_model=SandboxOut)
async def ensure_sandbox_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SandboxOut:
    """AC-004-01/-02/-03: idempotent ensure-mine. Also lazily materialises
    the tenant's canonical template on first call (ADR-002 scope item 1) --
    cheap after the first tenant-wide call, since `provision_canonical_
    template` is itself idempotent on the workspace's slug.
    """
    artefact = _seed_artefact()
    try:
        async with tenant_connection(principal.tenant_id) as conn:
            await sandbox.provision_canonical_template(
                conn, tenant_id=principal.tenant_id, artefact=artefact
            )
            result = await sandbox.ensure_sandbox(
                conn,
                tenant_id=principal.tenant_id,
                user_sub=principal.sub,
                user_iri=principal.principal_iri,
                artefact=artefact,
            )
    except sandbox.SandboxForkFailed as exc:
        # AC-004-03: fork failed before the pointer was ever touched --
        # surfaced as a retryable client error, never a bare 500.
        raise HTTPException(status_code=502, detail={"error": "sandbox_fork_failed"}) from exc
    return SandboxOut(workspace_id=result.workspace_id, reused=result.reused)


@router.post("/sandbox/reset", response_model=SandboxResetOut)
async def reset_sandbox_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SandboxResetOut:
    """AC-005-01/02/03/04/05/06: the ONLY entry point that can ever reset a
    sandbox -- explicit endpoint, no timer/navigation trigger anywhere else
    (AC-005-05). Blue/green, pointer-last (ADR-002 Sec4): the "green"
    workspace is built on its own connection/transaction first (a multi-
    second step that must never hold the pointer-flip transaction open), the
    pointer-flip + exercise-flag clear is a second, tight transaction (AC-
    005-03), and the old "blue" workspace's delete is a third, independent
    attempt -- its failure (commonly a `workspace_members`/`principals` FK)
    is logged as an orphan for sweep (AC-005-06) and never unwinds the swap
    that already committed.
    """
    artefact = _seed_artefact()
    async with tenant_connection(principal.tenant_id) as conn:
        old_workspace_id = await store.get_sandbox_workspace_id(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
    if old_workspace_id is None:
        # AC-005-02 presupposes a sandbox already exists to reset into.
        raise HTTPException(status_code=409, detail={"error": "sandbox_not_provisioned"})

    try:
        async with tenant_connection(principal.tenant_id) as conn:
            new_workspace = await sandbox.build_reset_workspace(
                conn, tenant_id=principal.tenant_id, user_sub=principal.sub, artefact=artefact
            )
    except sandbox.SandboxForkFailed as exc:
        # AC-005-04: the pointer was never touched -- old sandbox stays live.
        raise HTTPException(status_code=502, detail={"error": "sandbox_reset_failed"}) from exc

    async with tenant_connection(principal.tenant_id) as conn:
        await store.swap_sandbox_pointer(
            conn,
            tenant_id=principal.tenant_id,
            user_id=principal.principal_iri,
            workspace_id=new_workspace.id,
            semver=artefact.semver,
        )

    orphaned_workspace_id: str | None = None
    try:
        async with tenant_connection(principal.tenant_id) as conn:
            await delete_workspace(
                conn, tenant_id=principal.tenant_id, workspace_id=old_workspace_id
            )
    except Exception:  # AC-005-06: any delete failure is an orphan, not a reset failure.
        orphaned_workspace_id = old_workspace_id
        logger.warning(
            "sandbox reset: old workspace %s orphaned (delete failed), swept later",
            old_workspace_id,
        )

    return SandboxResetOut(
        workspace_id=new_workspace.id, orphaned_workspace_id=orphaned_workspace_id
    )


@router.put("/path", response_model=OnboardingPathOut)
async def put_path_route(
    body: OnboardingPathChoiceRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> OnboardingPathOut:
    """AC-006-04: change my onboarding path -- persists immediately, resets
    the read-only variant (a manual choice is always the default variant).
    """
    async with tenant_connection(principal.tenant_id) as conn:
        await store.patch_state(
            conn,
            tenant_id=principal.tenant_id,
            user_id=principal.principal_iri,
            patch=store.StatePatch(
                role_path=body.role_path, path_variant="default", path_chosen_manually=True
            ),
        )
    return _to_path_out(role_path=body.role_path, path_variant="default", path_chosen_manually=True)


@router.put("/tours/{tour_id}/progress", response_model=SavedResponse)
async def upsert_tour_progress_route(
    tour_id: str,
    body: TourProgressRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SavedResponse:
    patch = store.TourProgressPatch(**body.model_dump())
    async with tenant_connection(principal.tenant_id) as conn:
        await store.upsert_tour_progress(
            conn,
            tenant_id=principal.tenant_id,
            user_id=principal.principal_iri,
            tour_id=tour_id,
            patch=patch,
        )
    return SavedResponse(saved=True)


@router.put("/dismissals/{kind}/{ref_id}", response_model=SavedResponse)
async def upsert_dismissal_route(
    kind: DismissalKindIn,
    ref_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SavedResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        await store.upsert_dismissal(
            conn,
            tenant_id=principal.tenant_id,
            user_id=principal.principal_iri,
            kind=kind,
            ref_id=ref_id,
        )
    return SavedResponse(saved=True)


@router.delete("/dismissals/beacon", response_model=BulkDeletedResponse)
async def delete_beacon_dismissals_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> BulkDeletedResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        count = await store.delete_beacon_dismissals(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
    return BulkDeletedResponse(deleted_count=count)


@router.delete("/dismissals/{kind}/{ref_id}", response_model=DeletedResponse)
async def delete_dismissal_route(
    kind: DismissalKindIn,
    ref_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> DeletedResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        found = await store.delete_dismissal(
            conn,
            tenant_id=principal.tenant_id,
            user_id=principal.principal_iri,
            kind=kind,
            ref_id=ref_id,
        )
    return DeletedResponse(deleted=found)


async def _resolve_sandbox_named_graph(
    conn: asyncpg.Connection, *, tenant_id: str, user_id: str
) -> str:
    """AC-009-02: the sandbox `named_graph_iri` a `sparql_ask` check runs
    against is always resolved server-side from the caller's own sandbox
    pointer -- never a client-supplied graph IRI.
    """
    workspace_id = await store.get_sandbox_workspace_id(conn, tenant_id=tenant_id, user_id=user_id)
    workspace = (
        await get_workspace(conn, tenant_id=tenant_id, workspace_id=workspace_id)
        if workspace_id
        else None
    )
    if workspace is None:
        raise HTTPException(status_code=409, detail={"error": "no_sandbox"})
    return workspace.named_graph_iri


@router.post("/exercises/{exercise_id}/check", response_model=ExerciseCheckResult)
async def check_exercise_route(
    exercise_id: str,
    body: ExerciseCheckRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ExerciseCheckResult:
    """AC-009-01/02/03/04: server-verified exercise completion -- gating,
    the sandbox graph resolution, and the persisted state are all decided
    here, never trusted from the client.
    """
    exercise = EXERCISES.get(exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail={"error": "unknown_exercise"})

    async with tenant_connection(principal.tenant_id) as conn:
        onboarding_state = await store.get_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
        gate = gate_exercise(
            exercise_id,
            role_path=onboarding_state.role_path,
            path_variant=onboarding_state.path_variant,
        )
        if not gate.available:
            raise HTTPException(status_code=403, detail={"error": gate.reason})

        named_graph_iri = None
        if exercise["completion"]["kind"] == "sparql_ask":
            named_graph_iri = await _resolve_sandbox_named_graph(
                conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
            )

        try:
            outcome = await check_completion(
                exercise["completion"],
                named_graph_iri=named_graph_iri,
                claimed_signals=frozenset(body.signals),
            )
        except UnsupportedCompletionKindError as exc:
            raise HTTPException(
                status_code=422, detail={"error": "unsupported_completion_kind"}
            ) from exc

        if not outcome.verified:
            return ExerciseCheckResult(exercise_id=exercise_id, verified=False)

        await store.record_exercise_completion_with_retry(
            conn,
            tenant_id=principal.tenant_id,
            user_id=principal.principal_iri,
            exercise_id=exercise_id,
            verified_signal=outcome.verified_signal,
        )
        refreshed = await store.get_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )

    completed_at = next(
        (c.completed_at for c in refreshed.exercise_completions if c.exercise_id == exercise_id),
        None,
    )
    return ExerciseCheckResult(
        exercise_id=exercise_id,
        verified=True,
        verified_signal=outcome.verified_signal,
        completed_at=completed_at,
    )
