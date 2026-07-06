"""BE-TASK-009 (build-engine EPIC-008/EPIC-009): `publish_and_write_back`
-- publish the generated bundle to S3 (AC-1/AC-2), then write its
BE-ARTEFACT-1 provenance back to the Constitution graph via CE-WRITE-1
(AC-3/AC-4/AC-6/AC-7/AC-8). Mirrors `generation/service.py`'s
`GenerationContext`/`GenerationDeps` injectable-collaborators pattern.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import asyncpg
import httpx

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.briefs.store import get_task_brief
from weave_backend.deploy.artefact_publisher import PublishError
from weave_backend.deploy.artefact_publisher import publish as _default_publish
from weave_backend.deploy.ce_write_client import apply_write_back
from weave_backend.generation.store import GenerationRun, get_generation_run_by_commit_sha
from weave_backend.projects.model import (
    Project,
    get_project,
    update_project_publish,
    update_project_write_back,
)
from weave_backend.requests.ce_read import extract_entity_iris
from weave_backend.requests.pipeline import BUILD_SERVICE_PRINCIPAL_IRI
from weave_backend.schemas.operations import ViolationsResponse

__all__ = [
    "DEFAULT_DEPS",
    "DeployContext",
    "DeployDeps",
    "GenerationRunNotFoundError",
    "ProjectNotFoundError",
    "publish_and_write_back",
]


class ProjectNotFoundError(Exception):
    """404 `not_found` (pseudocode: "get_project -> 404 not_found")."""


class GenerationRunNotFoundError(Exception):
    """404 `not_found` -- no `generation_runs` row for this `commit_sha`."""


@dataclass(frozen=True)
class DeployContext:
    """Per-call context. `ce_write_client` is injected the same way
    `GenerationContext.ce_client` is -- a `Depends(get_ce_write_client)`
    `httpx.AsyncClient`, never constructed inline.
    """

    tenant_id: str
    project_iri: str
    task_id: str
    commit_sha: str
    run_mode: str
    ce_write_client: httpx.AsyncClient


@dataclass(frozen=True)
class DeployDeps:
    """Side-effecting collaborators, swappable in tests (Law F: never a
    real S3 put in a unit test).
    """

    publish_fn: Callable[[str, str, str], Awaitable[str]]
    emit_audit: Callable[[asyncpg.Connection, AuditEvent], Awaitable[None]]


async def _emit_audit(conn: asyncpg.Connection, event: AuditEvent) -> None:
    await default_audit_emitter.emit(conn, event)


DEFAULT_DEPS = DeployDeps(publish_fn=_default_publish, emit_audit=_emit_audit)


def _provenance_header(task_id: str, project: Project, entity_iris: list[str]) -> dict[str, Any]:
    """BE-ARTEFACT-1 header (AC-3): `{spec_id, pinned_version_iri, entity_iris}`."""
    return {
        "spec_id": task_id,
        "pinned_version_iri": project.pinned_graph_version_iri,
        "entity_iris": entity_iris,
    }


async def _publish(
    conn: asyncpg.Connection,
    ctx: DeployContext,
    deps: DeployDeps,
    project: Project,
    run: GenerationRun,
) -> dict[str, object] | str:
    """AC-1/AC-2: publishes the bundle, returning either the durable S3
    URI (success) or the `publish_failed` response body (`PublishError`).
    """
    try:
        output_location_ref = await deps.publish_fn(ctx.commit_sha, ctx.tenant_id, run.run_id)
    except PublishError as exc:
        return {
            "publish_status": "failed",
            "error": str(exc),
            "prior_output_location_ref": project.demo_output_location_ref,
        }
    await update_project_publish(
        conn,
        tenant_id=ctx.tenant_id,
        project_iri=ctx.project_iri,
        demo_output_location_ref=output_location_ref,
    )
    return output_location_ref


async def _write_back(
    conn: asyncpg.Connection,
    ctx: DeployContext,
    deps: DeployDeps,
    project: Project,
    run: GenerationRun,
) -> dict[str, object]:
    """AC-3/AC-4/AC-7: writes the BE-ARTEFACT-1 provenance header to
    CE-WRITE-1, committing (201) or routing to HITL (422). Raises
    `CeWriteUnavailable` (AC-8) -- the caller does not catch it, so it
    propagates to the router's 503 mapping.
    """
    brief = await get_task_brief(conn, tenant_id=ctx.tenant_id, task_id=ctx.task_id)
    entity_iris = extract_entity_iris(brief.content if brief else None)
    header = _provenance_header(ctx.task_id, project, entity_iris)
    operations = [{"op": "update_node", "iri": iri, "properties": header} for iri in entity_iris]

    response = await apply_write_back(
        ctx.ce_write_client, operations=operations, actor=BUILD_SERVICE_PRINCIPAL_IRI
    )
    if isinstance(response, ViolationsResponse):
        violations = [v.model_dump() for v in response.violations]
        await deps.emit_audit(
            conn,
            AuditEvent(
                tenant_id=ctx.tenant_id,
                event_type="write_back_fail_shacl",
                actor_iri=BUILD_SERVICE_PRINCIPAL_IRI,
                subject_iri=ctx.project_iri,
                payload={"violations": violations},
                engine="build",
            ),
        )
        return {"write_back_status": "rejected", "violations": violations}

    artefact_iri = f"urn:weave:artefact:{ctx.tenant_id}:{run.run_id}"
    await update_project_write_back(
        conn,
        tenant_id=ctx.tenant_id,
        project_iri=ctx.project_iri,
        write_back_artefact_iri=artefact_iri,
    )
    await deps.emit_audit(
        conn,
        AuditEvent(
            tenant_id=ctx.tenant_id,
            event_type="write_back_success",
            actor_iri=BUILD_SERVICE_PRINCIPAL_IRI,
            subject_iri=ctx.project_iri,
            payload={"artefact_iri": artefact_iri, "activity_iri": response.activity_iri},
            engine="build",
        ),
    )
    return {
        "write_back_status": "committed",
        "write_back_artefact_iri": artefact_iri,
        "activity_iri": response.activity_iri,
        "applied_count": response.applied_count,
    }


async def publish_and_write_back(
    conn: asyncpg.Connection, ctx: DeployContext, deps: DeployDeps = DEFAULT_DEPS
) -> dict[str, object]:
    """AC-1..AC-8: publish the bundle, then write its provenance back to
    the Constitution graph unless `run_mode` is `spike` (AC-6).
    """
    project = await get_project(conn, tenant_id=ctx.tenant_id, project_iri=ctx.project_iri)
    if project is None:
        raise ProjectNotFoundError(ctx.project_iri)

    run = await get_generation_run_by_commit_sha(
        conn, tenant_id=ctx.tenant_id, commit_sha=ctx.commit_sha
    )
    if run is None:
        raise GenerationRunNotFoundError(ctx.commit_sha)

    publish_outcome = await _publish(conn, ctx, deps, project, run)
    if isinstance(publish_outcome, dict):
        return publish_outcome
    output_location_ref = publish_outcome

    if ctx.run_mode == "spike":
        return {
            "output_location_ref": output_location_ref,
            "write_back_status": "skipped",
            "reason": "spike_mode",
        }

    write_back_outcome = await _write_back(conn, ctx, deps, project, run)
    return {"output_location_ref": output_location_ref, **write_back_outcome}
