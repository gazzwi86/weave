"""CE-TASK-005: instance CRUD (E2-S1/-S2) + browse/search (E2-S4).

Every mutation here builds a CE-WRITE-1 `Op` and dispatches through
`routers.operations._run_apply` -- the same entry point `authoring.py`'s
endpoints use (design decision: instance mutations use the same
CE-WRITE-1 pipeline as ontology-authoring mutations; no second write path).
Read-only endpoints (browse, delete-preview) query the workspace's live
draft graph (`named_graph_iri`) directly, the same pattern
`routers/search.py` (PLAT-TASK-005) already established.
"""

from __future__ import annotations

import logging
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from rdflib import Graph

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.authoring.bpmo import InvalidBpmoKindError, validate_kind
from weave_backend.db.pool import tenant_connection
from weave_backend.instances.browse import build_browse_query, paginate
from weave_backend.instances.delete_confirm import dependent_edges
from weave_backend.instances.duplicates import find_duplicate_iri
from weave_backend.instances.violations import humanize_violations
from weave_backend.ontology.resource import lookup_resource
from weave_backend.operations import outbox, versioning
from weave_backend.rbac import enforce_workspace_role
from weave_backend.rdf.oxigraph_client import fetch_graph_turtle, run_query
from weave_backend.routers.operations import _run_apply
from weave_backend.schemas.instances import (
    AddInstanceRequest,
    BrowseInstancesResponse,
    DeleteConfirmEdge,
    DeleteConfirmResponse,
    InstanceMutationResponse,
    InstanceSummary,
    InstanceViolation,
    InstanceViolationsResponse,
    UpdateInstanceRequest,
)
from weave_backend.schemas.operations import (
    AddEdgeOp,
    AddNodeOp,
    ApplyRequest,
    ApplyResponse,
    DeleteNodeOp,
    Op,
    UpdateNodeOp,
    ViolationsResponse,
)
from weave_backend.tenancy.sessions import get_active_workspace
from weave_backend.tenancy.workspaces import Workspace, get_workspace

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/instances", tags=["instances"])


def _local_name(iri: str) -> str:
    return iri.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


async def _load_active_workspace(
    conn: asyncpg.Connection, principal: Principal
) -> tuple[Workspace, str]:
    """Resolves the caller's active workspace and enforces `read` role --
    the floor every route here needs, even the ones (mutations) that go on
    to enforce `author` again inside `_run_apply`: this stops a principal
    with *no* membership at all reaching even the read-only branches
    (browse, delete-preview) that never call `_run_apply` themselves.
    """
    workspace_id = await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})
    workspace = await get_workspace(conn, tenant_id=principal.tenant_id, workspace_id=workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})
    await enforce_workspace_role(
        conn,
        tenant_id=principal.tenant_id,
        workspace_id=workspace_id,
        user_sub=principal.sub,
        min_role="read",
    )
    return workspace, workspace_id


async def _dispatch(
    principal: Principal, workspace_id: str, conn: asyncpg.Connection, ops: list[Op]
) -> ApplyResponse | ViolationsResponse | HTTPException:
    """Same shape as `routers.authoring._dispatch`: one `ApplyRequest`
    through CE-WRITE-1's real entry point, outbox flushed on success. `ops`
    is a list, not a single op -- AC-005-01: a kind with a hard relationship
    requirement (e.g. ProcessShape's `performedBy`) can only pass SHACL
    re-validation if its `add_node` and the linking `add_edge` land in the
    same batch (SHACL validates the whole graph per batch, never
    per-op) -- see `AddInstanceRequest.relationships`.
    """
    body = ApplyRequest(operations=ops, actor=principal.principal_iri)
    outcome = await _run_apply(conn, principal=principal, workspace_id=workspace_id, body=body)
    if isinstance(outcome, ApplyResponse):
        try:
            async with tenant_connection(principal.tenant_id) as flush_conn:
                await outbox.flush_pending(flush_conn, principal.tenant_id)
        except Exception:
            log.warning(
                "post-commit outbox flush failed for tenant=%s", principal.tenant_id, exc_info=True
            )
    return outcome


def _violations_json(outcome: ViolationsResponse) -> JSONResponse:
    violations = [InstanceViolation(**v) for v in humanize_violations(outcome.violations)]
    return JSONResponse(
        status_code=422,
        content=InstanceViolationsResponse(violations=violations).model_dump(),
    )


@router.post(
    "",
    response_model=InstanceMutationResponse,
    status_code=201,
    responses={409: {}, 422: {"model": InstanceViolationsResponse}},
)
async def add_instance_route(
    body: AddInstanceRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> InstanceMutationResponse | JSONResponse:
    """AC-005-01/-02/-03/-04."""
    try:
        validate_kind(body.kind)
    except InvalidBpmoKindError as exc:
        raise HTTPException(status_code=400, detail={"error": "invalid_bpmo_kind"}) from exc

    async with tenant_connection(principal.tenant_id) as conn:
        workspace, workspace_id = await _load_active_workspace(conn, principal)

        existing_iri = await find_duplicate_iri(workspace.named_graph_iri, body.kind, body.label)
        if existing_iri is not None:
            return JSONResponse(
                status_code=409,
                content={"error": "duplicate_entity", "existing_iri": existing_iri},
            )

        ops: list[Op] = [
            AddNodeOp(
                op="add_node",
                ref="n1",
                kind=body.kind,
                label=body.label,
                properties=body.properties,
            ),
        ]
        ops.extend(
            AddEdgeOp(op="add_edge", subject_ref="n1", predicate=predicate, object_ref=target_iri)
            for predicate, target_iri in body.relationships.items()
        )
        outcome = await _dispatch(principal, workspace_id, conn, ops)

    if isinstance(outcome, HTTPException):
        raise outcome
    if isinstance(outcome, ViolationsResponse):
        return _violations_json(outcome)
    return InstanceMutationResponse(
        iri=outcome.ref_map["n1"],
        version_iri=outcome.version_iri,
        activity_iri=outcome.activity_iri,
    )


@router.patch(
    "/{iri:path}",
    response_model=ApplyResponse,
    responses={422: {"model": InstanceViolationsResponse}},
)
async def update_instance_route(
    iri: str,
    body: UpdateInstanceRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ApplyResponse | JSONResponse:
    """AC-005-06/-09: partial-update -- only the named properties change,
    everything else on the node is left untouched by the shared pipeline's
    `_apply_update_node`.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        _workspace, workspace_id = await _load_active_workspace(conn, principal)
        op = UpdateNodeOp(op="update_node", iri=iri, properties=body.properties)
        outcome = await _dispatch(principal, workspace_id, conn, [op])

    if isinstance(outcome, HTTPException):
        raise outcome
    if isinstance(outcome, ViolationsResponse):
        return _violations_json(outcome)
    return outcome


async def _is_referenced_by_published_version(
    conn: asyncpg.Connection, principal: Principal, workspace_id: str, iri: str
) -> bool:
    """AC-005-10: true if `iri` is visible in the newest *published* graph
    -- deleting it would affect published data, not just the draft.
    """
    try:
        published_version_iri = await versioning.resolve_version(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id, version="latest"
        )
    except versioning.VersionNotFound:
        return False
    resource = await lookup_resource(published_version_iri, iri)
    return resource is not None


async def _delete_preview(
    conn: asyncpg.Connection,
    principal: Principal,
    workspace: Workspace,
    workspace_id: str,
    iri: str,
) -> DeleteConfirmResponse:
    turtle = await fetch_graph_turtle(workspace.named_graph_iri)
    graph = Graph()
    if turtle:
        graph.parse(data=turtle, format="turtle")
    deps = dependent_edges(graph, iri)
    published = await _is_referenced_by_published_version(conn, principal, workspace_id, iri)
    return DeleteConfirmResponse(
        outgoing=[DeleteConfirmEdge(predicate=e.predicate, other=e.other) for e in deps.outgoing],
        incoming=[DeleteConfirmEdge(predicate=e.predicate, other=e.other) for e in deps.incoming],
        published=published,
    )


@router.delete(
    "/{iri:path}",
    # Mixed pydantic-model union (preview vs. commit result) alongside a raw
    # JSONResponse for the 409/422 branches -- not a single valid Pydantic
    # response field, so this route documents its own responses instead.
    response_model=None,
    responses={422: {"model": InstanceViolationsResponse}},
)
async def delete_instance_route(
    iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
    confirm: bool = Query(default=False),
) -> DeleteConfirmResponse | ApplyResponse | JSONResponse:
    """AC-005-07/-08/-10: without `?confirm=true`, returns a preview of the
    dependent edges (and published-version status) that would be affected --
    nothing is mutated. With `?confirm=true`, dispatches the real
    `delete_node`; the shared pipeline's cascade + SHACL re-validation
    already reject (422, no commit) a delete that would leave a
    SHACL-required relationship dangling.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        workspace, workspace_id = await _load_active_workspace(conn, principal)

        if not confirm:
            return await _delete_preview(conn, principal, workspace, workspace_id, iri)

        op = DeleteNodeOp(op="delete_node", iri=iri)
        outcome = await _dispatch(principal, workspace_id, conn, [op])

    if isinstance(outcome, HTTPException):
        raise outcome
    if isinstance(outcome, ViolationsResponse):
        return _violations_json(outcome)
    return outcome


@router.get("", response_model=BrowseInstancesResponse)
async def browse_instances_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    kind: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    cursor: int = Query(default=0, ge=0),
) -> BrowseInstancesResponse:
    """AC-005-11/-12/-13/-14: browse/search over the workspace's live draft
    graph, optionally filtered by `kind` and/or a keyword `q` (ANDed when
    both given), ordered by label, 50/page with an offset cursor.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        workspace, _workspace_id = await _load_active_workspace(conn, principal)

    query = build_browse_query(kind=kind, keyword=q, offset=cursor)
    raw = await run_query(query, workspace.named_graph_iri)
    bindings = raw.get("results", {}).get("bindings", [])
    page_rows, next_cursor = paginate(bindings, cursor)
    results = [
        InstanceSummary(
            iri=row["iri"]["value"],
            kind=_local_name(row["kind_iri"]["value"]) if "kind_iri" in row else "",
            label=row["label"]["value"],
        )
        for row in page_rows
    ]
    return BrowseInstancesResponse(results=results, next_page=next_cursor)
