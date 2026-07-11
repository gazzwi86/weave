"""BE-V1-TASK-005 (BE-SDK-1 delivery, E8-S5/FR-059): trigger/run/ack
orchestration wrapping the TASK-004 pipeline (`sdkgen.pipeline.generate_sdk`)
in the delivery machinery -- CE-DIFF-1 breaking-span refusal, the
`sdk_breaking_ack` HITL ack, BE-ARTEFACT-1 provenance stamping,
`{ce_version_tag}+build.{n}` versioning, and the single atomic
`ScmDriver.commit_workspace` + projects-bookkeeping transaction (AC-5).

`run_sdk_generation` (the trigger route's `BackgroundTasks` callback) and
`approve_sdk_breaking_ack` (the HITL ack-resume path, routed in from
`build/hitl.py`) both funnel into `_generate_and_commit` -- the ONE
`commit_workspace` call site DoD requires. Every DB write here opens its
OWN `tenant_connection` (never a connection borrowed from the request that
enqueued the background task): Starlette runs `BackgroundTasks` after the
response has already been sent, by which point the request's own
connection is already released back to the pool.
"""

from __future__ import annotations

import os
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Protocol

import asyncpg
import httpx

from weave_backend.build.gates import GateRecord, record_gate
from weave_backend.build.hitl import HitlGateContext, SelfApprovalNotPermitted, fire_hitl_gate
from weave_backend.db.pool import tenant_connection
from weave_backend.generation.sdk_commit import _generate_and_commit as _generate_and_commit
from weave_backend.generation.sdk_store import (
    IN_FLIGHT_STATUSES,
    SdkGenerationRun,
    get_sdk_run,
    insert_sdk_generation_run,
    lock_latest_sdk_run,
    update_sdk_run_status,
)
from weave_backend.identity.registry import get_principal
from weave_backend.projects.ce_version_client import DEFAULT_CE_BASE_URL, get_ontology_diff
from weave_backend.projects.model import Project, get_project
from weave_backend.repo_bootstrap.service import (
    BUILD_SERVICE_PRINCIPAL_IRI,
    DEFAULT_DEPS,
    RepoBootstrapDeps,
)
from weave_backend.sdkgen.ir import CeVersionPin

_SDK_GENERATION_EVIDENCE = "sdk_breaking_change"


class _HasPrincipalType(Protocol):
    @property
    def type(self) -> str: ...


@dataclass(frozen=True)
class SdkAckDeps:
    """Bundles `approve_sdk_breaking_ack`'s two injection seams (Law E:
    max 5 params) -- `resolve_principal` is threaded uniformly through
    `build/hitl.py::handle_hitl_response` for every gate type (mirrors
    `rich_scaffold.approve_env_verification`'s D9 shape); `repo_deps` is
    the SCM/secret seam `run_sdk_generation` also uses, so ack-resume can
    swap in a stub driver without a real GitHub call.
    """

    resolve_principal: Callable[..., Awaitable[_HasPrincipalType]] = get_principal
    repo_deps: RepoBootstrapDeps | None = None


class ProjectHasNoPinnedVersion(Exception):
    """422: `POST .../sdk-generations` on a project with no pinned CE version."""


class SdkGenerationInFlight(Exception):
    """409: an SDK run for this project is already `queued|running|breaking_hold`."""


class SdkGenerationRunNotFound(Exception):
    """The ack-resume path's `run_id` doesn't resolve for this tenant."""


async def trigger_sdk_generation(
    conn: asyncpg.Connection, *, project: Project, tenant_id: str
) -> SdkGenerationRun:
    """AC-1: enqueue a new `queued` run. Caller (router) already holds the
    `conn`'s transaction open, so `lock_latest_sdk_run`'s `FOR UPDATE`
    genuinely serialises concurrent triggers within it (Implementation
    Hints: lock the newest run row, not an advisory flag).
    """
    if not project.pinned_graph_version_iri:
        raise ProjectHasNoPinnedVersion(project.project_iri)

    existing = await lock_latest_sdk_run(
        conn, tenant_id=tenant_id, project_iri=project.project_iri
    )
    if existing is not None and existing.status in IN_FLIGHT_STATUSES:
        raise SdkGenerationInFlight(existing.run_id)

    return await insert_sdk_generation_run(
        conn, tenant_id=tenant_id, project_iri=project.project_iri
    )


async def _breaking_version_iris(
    ce_client: httpx.AsyncClient | None, *, from_version: str, to_version: str
) -> list[str]:
    """AC-2: CE-DIFF-1's `versions` breaking-span, read defensively (Build
    never derives breakingness itself -- contracts.md CE-DIFF-1). A default
    client is opened when the caller doesn't inject one (production, no
    request-scoped `Depends(get_ce_client)` available from a background
    task).
    """
    if ce_client is not None:
        body = await get_ontology_diff(ce_client, from_version=from_version, to_version=to_version)
        return [v["version_iri"] for v in body.get("versions", []) if v.get("breaking")]

    base_url = os.environ.get("CE_API_BASE_URL", DEFAULT_CE_BASE_URL)
    async with httpx.AsyncClient(base_url=base_url, timeout=5.0) as default_client:
        body = await get_ontology_diff(
            default_client, from_version=from_version, to_version=to_version
        )
        return [v["version_iri"] for v in body.get("versions", []) if v.get("breaking")]


async def run_sdk_generation(
    *,
    tenant_id: str,
    run_id: str,
    project_iri: str,
    ce_client: httpx.AsyncClient | None = None,
    deps: RepoBootstrapDeps | None = None,
) -> None:
    """The trigger route's `BackgroundTasks` entry point (pseudocode's
    `run_generation`): AC-2/AC-4 breaking-span check, then AC-5/AC-6
    generate+commit via `_generate_and_commit`. No `auth_header` param
    (unlike `requests/pipeline.py`'s CE calls) -- CE-DIFF-1 here is always
    read by the build-engine service actor, not on behalf of the request's
    human principal, and this callback runs after the request that
    enqueued it has already returned (Starlette `BackgroundTasks`).
    """
    async with tenant_connection(tenant_id) as conn:
        project = await get_project(conn, tenant_id=tenant_id, project_iri=project_iri)
    if project is None:
        return  # project vanished between trigger and dispatch -- nothing to run

    if project.last_sdk_version_iri is not None:
        # AC-4: a project's first generation has nothing to diff against.
        breaking = await _breaking_version_iris(
            ce_client,
            from_version=project.last_sdk_version_iri,
            to_version=project.pinned_graph_version_iri,
        )
        if breaking:
            async with tenant_connection(tenant_id) as conn:
                await update_sdk_run_status(
                    conn,
                    tenant_id=tenant_id,
                    run_id=run_id,
                    status="breaking_hold",
                    payload={"breaking_hold": {"version_iris": breaking}},
                )
                await fire_hitl_gate(
                    conn,
                    HitlGateContext(
                        tenant_id=tenant_id,
                        task_id=f"sdk_generation:{run_id}",
                        submitting_principal_iri=BUILD_SERVICE_PRINCIPAL_IRI,
                        evidence=_SDK_GENERATION_EVIDENCE,
                    ),
                )
            return

    pin = CeVersionPin(version_iri=project.pinned_graph_version_iri)
    await _generate_and_commit(
        tenant_id=tenant_id, run_id=run_id, project=project, pin=pin, deps=deps or DEFAULT_DEPS
    )


async def approve_sdk_breaking_ack(
    conn: asyncpg.Connection,
    *,
    run_id: str,
    tenant_id: str,
    approving_principal_iri: str,
    ack_deps: SdkAckDeps | None = None,
) -> None:
    """AC-3: the `sdk_breaking_ack` HITL release path -- mirrors
    `rich_scaffold.approve_env_verification`'s D9 shape. The submitting
    principal is always the automated `BUILD_SERVICE_PRINCIPAL_IRI` (never
    stored per-run), so self-approval is a direct IRI match against that
    known constant rather than a DB round-trip; a resolved non-human
    principal is rejected the same way. Persists the `gate_results` row,
    then resumes straight to `_generate_and_commit` (pseudocode's
    `on_ack`) -- the breaking check itself is never re-run post-ack.
    """
    if approving_principal_iri == BUILD_SERVICE_PRINCIPAL_IRI:
        raise SelfApprovalNotPermitted(approving_principal_iri)

    deps = ack_deps or SdkAckDeps()
    principal = await deps.resolve_principal(conn, tenant_id=tenant_id, iri=approving_principal_iri)
    if principal.type != "human":
        raise SelfApprovalNotPermitted(approving_principal_iri)

    run = await get_sdk_run(conn, tenant_id=tenant_id, run_id=run_id)
    if run is None:
        raise SdkGenerationRunNotFound(run_id)

    await record_gate(
        conn,
        GateRecord(
            tenant_id=tenant_id,
            actor_iri=approving_principal_iri,
            event_type="sdk_breaking_ack_approved",
            subject_iri=run_id,
            gate="sdk_breaking_ack",
            result="approved",
            payload={"approver": approving_principal_iri},
            run_id=run_id,
        ),
    )

    project = await get_project(conn, tenant_id=tenant_id, project_iri=run.project_iri)
    if project is None:
        raise SdkGenerationRunNotFound(run_id)

    pin = CeVersionPin(version_iri=project.pinned_graph_version_iri)
    await _generate_and_commit(
        tenant_id=tenant_id,
        run_id=run_id,
        project=project,
        pin=pin,
        deps=deps.repo_deps or DEFAULT_DEPS,
    )


