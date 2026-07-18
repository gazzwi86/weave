"""CE-TASK-005/G3: the tenant governance-shapes surface -- rides the
existing `POST /api/ontology/authoring/nl` family (task brief API
Contracts) with a shapes-graph target. Two steps mirror ADR-007's
propose-then-confirm pattern (also used by CE-TASK-006's `preview` flag):
preview never commits (AC-005-01/-05), commit re-validates server-side
regardless of origin and is the only caller of `commit_tenant_shape`
(ADR-024/ADR-028). `DELETE /shapes` (G3, remediation-2-api-gaps.md) is the
sole caller of `retire_tenant_shape` -- same "one writer module" rule.

Tenant-wide, not workspace-scoped (the shapes graph has no workspace
segment -- ADR-023), so `require_tenant_admin` gates it, not
`enforce_workspace_role`.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.auth.dependencies import Principal
from weave_backend.authoring.shapes import (
    ShapeGenerationError,
    generate_candidate_shape,
    parse_raw_shape,
    shape_subject_iri,
)
from weave_backend.db.pool import tenant_connection
from weave_backend.operations.governance_shapes import (
    FrameworkShapeImmutableError,
    ShapeCommit,
    ShapeNotFoundError,
    commit_tenant_shape,
    retire_tenant_shape,
)
from weave_backend.rbac import require_tenant_admin
from weave_backend.schemas.governance import (
    ShapeRuleCommitRequest,
    ShapeRuleCommitResponse,
    ShapeRulePreviewRequest,
    ShapeRulePreviewResponse,
)
from weave_backend.tenancy.sessions import get_redis

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ontology/authoring", tags=["governance"])


@router.post("/nl/shapes/preview", response_model=ShapeRulePreviewResponse)
async def preview_shape_route(
    body: ShapeRulePreviewRequest,
    principal: Annotated[Principal, Depends(require_tenant_admin)],
) -> ShapeRulePreviewResponse:
    """AC-005-01: candidate shape for human review -- never committed here.
    AC-005-05/-07: an AI output that isn't a safe shape is a 422 (raw-SHACL
    path stays live); an unreachable/misconfigured model provider is a 503,
    never a raw exception.
    """
    del principal  # RBAC-only: no per-tenant data read here.
    try:
        shape_graph = generate_candidate_shape(body.text)
    except ShapeGenerationError as exc:
        raise HTTPException(
            status_code=422, detail={"error": "shape_generation_failed", "message": str(exc)}
        ) from exc
    except Exception as exc:
        log.warning("governance shape preview provider call failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=503, detail={"error": "model_provider_unavailable"}
        ) from exc
    return ShapeRulePreviewResponse(shape_turtle=shape_graph.serialize(format="turtle"))


@router.post("/nl/shapes/commit", response_model=ShapeRuleCommitResponse, status_code=201)
async def commit_shape_route(
    body: ShapeRuleCommitRequest,
    principal: Annotated[Principal, Depends(require_tenant_admin)],
) -> ShapeRuleCommitResponse:
    """AC-005-01/-05: re-validates `shape_turtle` server-side regardless of
    origin (preview-approved or hand-written raw-SHACL) -- a client-echoed
    payload is never trusted as already-safe. Sole caller of
    `commit_tenant_shape` (ADR-024).
    """
    try:
        shape_graph = parse_raw_shape(body.shape_turtle)
        shape_iri = shape_subject_iri(shape_graph)
    except ShapeGenerationError as exc:
        raise HTTPException(
            status_code=422, detail={"error": "invalid_shape", "message": str(exc)}
        ) from exc

    # pipeline.py's redis_client param takes the same `Any` escape hatch --
    # redis-py's concrete `Redis` doesn't structurally satisfy `RedisLike`
    # (param name `name` vs `key`), only matters for get_redis()'s real
    # runtime object, which behaves correctly.
    redis: Any = get_redis()
    async with tenant_connection(principal.tenant_id) as conn:
        activity_iri = await commit_tenant_shape(
            conn,
            redis,
            ShapeCommit(
                tenant_id=principal.tenant_id,
                approver_iri=principal.principal_iri,
                shape_graph=shape_graph,
                shape_iri=shape_iri,
                ai_generated=body.ai_generated,
            ),
        )
    return ShapeRuleCommitResponse(shape_iri=shape_iri, activity_iri=activity_iri)


@router.delete("/shapes", status_code=204, response_model=None)
async def retire_shape_route(
    shape_iri: Annotated[str, Query(min_length=1)],
    principal: Annotated[Principal, Depends(require_tenant_admin)],
) -> None:
    """G3 (remediation-2-api-gaps.md): retracts a tenant-committed shape.
    404 if `shape_iri` isn't a committed tenant shape; 403 if it names a
    framework shape (only tenant shapes retire) -- both raised by
    `retire_tenant_shape`, translated here the same way `commit_shape_route`
    translates `ShapeGenerationError`.
    """
    redis: Any = get_redis()
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            await retire_tenant_shape(
                conn,
                redis,
                tenant_id=principal.tenant_id,
                approver_iri=principal.principal_iri,
                shape_iri=shape_iri,
            )
        except ShapeNotFoundError as exc:
            raise HTTPException(
                status_code=404, detail={"error": "shape_not_found"}
            ) from exc
        except FrameworkShapeImmutableError as exc:
            raise HTTPException(
                status_code=403, detail={"error": "framework_shape_immutable"}
            ) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": "invalid_shape_iri"}) from exc
