"""ONB-TASK-001: `/api/onboarding/*` -- per-(tenant, user) onboarding
progress state (path, tour resume points, dismissals, checklist, exercise
completions, activations). Same authz shape as notifications: a principal
only ever sees/mutates rows keyed by their own `user_id` -- no route accepts
a client-supplied user id, so `get_current_principal` + RLS is the whole
authz story (AC-001-03: "reject a foreign user id" has no input vector to
build, since one never arrives).
"""

from __future__ import annotations

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
from weave_backend.onboarding.exercises import EXERCISES, gate_exercise
from weave_backend.onboarding.hammerbarn_seed.compile import (
    CompiledArtefact,
    allowed_kinds_from_ontology_types,
    compile_seed,
)
from weave_backend.onboarding.path_resolver import resolve_role_path
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
    SavedResponse,
    TourProgressRequest,
)
from weave_backend.tenancy.workspaces import get_workspace

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


def _to_out(record: store.OnboardingStateRecord) -> OnboardingStateOut:
    return OnboardingStateOut(**record.model_dump())


@router.get("/state", response_model=OnboardingStateOut)
async def get_state_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> OnboardingStateOut:
    async with tenant_connection(principal.tenant_id) as conn:
        record = await store.get_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
    return _to_out(record)


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
    return _to_out(record)


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
