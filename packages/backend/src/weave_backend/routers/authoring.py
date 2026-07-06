"""TASK-004: NL, SHACL-form-restriction, and Turtle-import authoring surfaces
(E1-S1/-S2/-S3). Every endpoint here builds an `ApplyRequest` from its own
domain input and dispatches it through `routers.operations._run_apply` --
the exact RBAC (author-role), spike-write-back guard, target resolution,
and SHACL-violation handling CE-WRITE-1 already enforces for
`POST /api/operations/apply`. No authoring endpoint may write the graph any
other way (mirrors CE-WRITE-1's "single validated entry point" invariant).
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.authoring.imports import plan_import
from weave_backend.authoring.nl_parser import NlParseError, parse_operations
from weave_backend.authoring.restrictions import (
    RestrictionConflictError,
    build_disjoint_with_ops,
    build_min_cardinality_ops,
)
from weave_backend.db.pool import tenant_connection
from weave_backend.operations import outbox
from weave_backend.routers.operations import _run_apply
from weave_backend.schemas.authoring import (
    ImportRequest,
    ImportResult,
    NlAuthoringRequest,
    NlPreviewResponse,
    RestrictionRequest,
)
from weave_backend.schemas.operations import (
    AddNodeOp,
    ApplyRequest,
    ApplyResponse,
    Op,
    ViolationsResponse,
)
from weave_backend.tenancy.sessions import get_active_workspace

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ontology/authoring", tags=["authoring"])


async def _dispatch(principal: Principal, operations: list[Op]) -> ApplyResponse | JSONResponse:
    """Shared apply-and-respond path for every authoring endpoint: resolves
    the caller's active workspace, runs the batch through CE-WRITE-1's real
    entry point, and flushes the audit outbox on success -- same
    post-commit shape as `POST /api/operations/apply`.
    """
    workspace_id = await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})

    body = ApplyRequest(operations=operations, actor=principal.principal_iri)
    async with tenant_connection(principal.tenant_id) as conn:
        outcome = await _run_apply(conn, principal=principal, workspace_id=workspace_id, body=body)

    if isinstance(outcome, ApplyResponse):
        try:
            async with tenant_connection(principal.tenant_id) as flush_conn:
                await outbox.flush_pending(flush_conn, principal.tenant_id)
        except Exception:
            log.warning(
                "post-commit outbox flush failed for tenant=%s, will retry next flush",
                principal.tenant_id,
                exc_info=True,
            )

    if isinstance(outcome, HTTPException):
        raise outcome
    if isinstance(outcome, ViolationsResponse):
        return JSONResponse(status_code=422, content=outcome.model_dump())
    return outcome


@router.post(
    # CE-TASK-006: `preview` branch returns a `NlPreviewResponse`, not an
    # `ApplyResponse` -- a mixed union isn't a single valid Pydantic
    # response field, so (mirroring `routers/instances.py`'s delete route)
    # this route documents its own responses instead of declaring one.
    "/nl",
    response_model=None,
    status_code=201,
)
async def nl_authoring_route(
    body: NlAuthoringRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ApplyResponse | JSONResponse:
    """AC-004-01/-02: NL intent -> validated CE-WRITE-1 operations.

    CE-TASK-006 AC-006-02/-03: `body.preview=True` returns the parsed
    operation batch (200) for modeller confirmation instead of dispatching
    -- the chat panel's "propose, then confirm" flow. Default behaviour
    (commit immediately) is unchanged.
    """
    try:
        request = parse_operations(
            body.text,
            body.known_class_iris,
            actor=principal.principal_iri,
        )
    except NlParseError as exc:
        raise HTTPException(
            status_code=422, detail={"error": "nl_parse_failed", "message": str(exc)}
        ) from exc

    if body.preview:
        return JSONResponse(
            status_code=200,
            content=NlPreviewResponse(operations=request.operations).model_dump(),
        )

    return await _dispatch(principal, request.operations)


def _build_restriction_ops(body: RestrictionRequest) -> list[Op]:
    """`RestrictionRequest._check_required_fields` already guarantees the
    fields each branch needs are non-`None` -- re-checked here (400, not an
    assert) so a caller never gets an `AttributeError` if that guarantee
    ever drifts.
    """
    if body.restriction_type == "min_cardinality":
        if body.class_iri is None or body.property_iri is None or body.min_count is None:
            raise HTTPException(status_code=400, detail={"error": "missing_restriction_fields"})
        return build_min_cardinality_ops(
            body.class_iri,
            body.property_iri,
            body.min_count,
            existing_max_count=body.existing_max_count,
        )

    if body.class_a_iri is None or body.class_b_iri is None:
        raise HTTPException(status_code=400, detail={"error": "missing_restriction_fields"})
    return build_disjoint_with_ops(body.class_a_iri, body.class_b_iri)


@router.post("/restrictions", response_model=ApplyResponse, status_code=201)
async def restriction_authoring_route(
    body: RestrictionRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ApplyResponse | JSONResponse:
    """AC-004-06/-07/-08/-09: OWL restriction/disjointness op builders,
    surfacing a conflict as 409 before any CE-WRITE-1 dispatch.
    """
    try:
        ops = _build_restriction_ops(body)
    except RestrictionConflictError as exc:
        raise HTTPException(
            status_code=409, detail={"error": "restriction_conflict", "message": str(exc)}
        ) from exc

    return await _dispatch(principal, ops)


def _count_ops(operations: list[Op]) -> tuple[int, int, int]:
    """Returns (classes_added, properties_added, relationships_added) for
    the report in AC-004-12 -- `properties_added` counts the SHACL-shaped
    property/value pairs carried inline on each `add_node`, since the op
    vocabulary has no separate "property" op.
    """
    node_ops = [op for op in operations if isinstance(op, AddNodeOp)]
    properties_added = sum(len(op.properties) for op in node_ops)
    relationships_added = sum(1 for op in operations if op.op == "add_edge")
    return len(node_ops), properties_added, relationships_added


async def _dispatch_import_batch(
    principal: Principal, plan_operations: list[Op]
) -> ApplyResponse | JSONResponse | None:
    """Dispatches one batch and returns `None` only when there is nothing
    to commit.
    """
    if not plan_operations:
        return None
    return await _dispatch(principal, plan_operations)


@router.post("/import", response_model=ImportResult, status_code=201)
async def import_authoring_route(
    body: ImportRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ImportResult | JSONResponse:
    """AC-004-10/-11/-12/-13: Turtle import, staged as one draft batch;
    collisions are never silently resolved -- a first call with no
    `on_collision` decision returns the collision list instead of
    committing anything.

    All new nodes and edges from one import dispatch together, in one
    `ApplyRequest` (see imports.py docstring): SHACL validates the whole
    graph on every commit, so a node created before its required edge
    would always fail its shape's minCount check.
    """
    plan = plan_import(body.turtle, set(body.existing_class_iris))

    if plan.needs_collision_decision and body.on_collision is None:
        return JSONResponse(
            status_code=409,
            content={"error": "import_collision", "collision_iris": plan.collision_iris},
        )

    classes_added = properties_added = relationships_added = 0
    version_iri: str | None = None

    outcome = await _dispatch_import_batch(principal, plan.operations)
    if isinstance(outcome, JSONResponse):
        return outcome
    if isinstance(outcome, ApplyResponse):
        classes_added, properties_added, relationships_added = _count_ops(plan.operations)
        version_iri = outcome.version_iri

    if body.on_collision == "overwrite":
        outcome = await _dispatch_import_batch(principal, list(plan.collision_updates()))
        if isinstance(outcome, JSONResponse):
            return outcome
        if isinstance(outcome, ApplyResponse):
            version_iri = outcome.version_iri

    return ImportResult(
        classes_added=classes_added,
        properties_added=properties_added,
        relationships_added=relationships_added,
        unknown_kinds=sorted(plan.unknown_kinds),
        version_iri=version_iri,
    )
