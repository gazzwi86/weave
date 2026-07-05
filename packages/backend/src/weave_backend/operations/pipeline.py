"""CE-WRITE-1 orchestration: clone -> apply -> validate -> commit/discard.

Flow (see task brief diagram): auth/RBAC happen in the router before this
module is ever called. From here: idempotency check -> clone working graph
-> apply ops -> SHACL validate -> violation? discard+422 : commit new
version + promote working graph.

AC-001-10 (rollback): `_commit` always writes the version snapshot graph
*before* promoting the working graph, so any failure leaves the working
graph exactly as it was pre-request -- either the promote step never ran,
or it's the one that failed and never completed.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

import asyncpg
from rdflib import Graph

from weave_backend.operations import metrics
from weave_backend.operations.graph_ops import apply_operations
from weave_backend.operations.idempotency import (
    get_cached_response,
    release_lock,
    store_response,
    try_acquire_lock,
)
from weave_backend.operations.provenance import write_activity
from weave_backend.operations.shacl import validate_graph
from weave_backend.operations.versioning import mint_version
from weave_backend.rdf.oxigraph_client import fetch_graph_turtle, load_graph
from weave_backend.schemas.operations import (
    ApplyRequest,
    ApplyResponse,
    ViolationDetail,
    ViolationsResponse,
)

_POLL_ATTEMPTS = 200
_POLL_INTERVAL_SECONDS = 0.05


class InvalidTargetError(Exception):
    """`target` names a graph outside the caller's own resolved workspace
    (AC-001-09: a forged/foreign version_iri must never be accepted).
    """


@dataclass
class ApplyContext:
    tenant_id: str
    workspace_id: str
    named_graph_iri: str
    conn: asyncpg.Connection


def resolve_source_graph_iri(named_graph_iri: str, target: str) -> str:
    if target == "draft":
        return named_graph_iri
    if target.startswith(f"{named_graph_iri}:v"):
        return target
    raise InvalidTargetError(target)


async def _fetch_scratch_graph(source_graph_iri: str) -> Graph:
    turtle = await fetch_graph_turtle(source_graph_iri)
    graph = Graph()
    if turtle:
        graph.parse(data=turtle, format="turtle")
    return graph


async def _commit(ctx: ApplyContext, scratch: Graph) -> str:
    version_iri, _semver = await mint_version(
        ctx.conn,
        tenant_id=ctx.tenant_id,
        workspace_id=ctx.workspace_id,
        named_graph_iri=ctx.named_graph_iri,
    )
    turtle = scratch.serialize(format="turtle")
    await load_graph(version_iri, turtle)
    await load_graph(ctx.named_graph_iri, turtle)
    return version_iri


def _to_violation_detail(result: Any) -> ViolationDetail:
    return ViolationDetail(
        focus_node=result.focus_node,
        path=result.path,
        severity=result.severity,
        message=result.message,
    )


async def _apply_uncached(
    ctx: ApplyContext, request: ApplyRequest
) -> ApplyResponse | ViolationsResponse:
    source_graph_iri = resolve_source_graph_iri(ctx.named_graph_iri, request.target)
    scratch = await _fetch_scratch_graph(source_graph_iri)
    apply_result = apply_operations(scratch, request.operations)
    shacl_results = validate_graph(scratch)
    violations = [r for r in shacl_results if r.severity == "Violation"]

    if violations:
        await metrics.emit_mutation_outcome_metric("violation")
        return ViolationsResponse(violations=[_to_violation_detail(r) for r in violations])

    version_iri = await _commit(ctx, scratch)
    activity_iri = await write_activity(
        named_graph_iri=ctx.named_graph_iri, actor_iri=request.actor
    )
    await metrics.emit_mutation_outcome_metric("success")
    advisories = [_to_violation_detail(r) for r in shacl_results if r.severity != "Violation"]
    return ApplyResponse(
        activity_iri=activity_iri,
        applied_count=apply_result.applied_count,
        version_iri=version_iri,
        advisories=advisories,
    )


async def _apply_and_cache(
    ctx: ApplyContext, request: ApplyRequest, redis_client: Any
) -> ApplyResponse | ViolationsResponse:
    result = await _apply_uncached(ctx, request)
    if isinstance(result, ApplyResponse) and request.idempotency_key:
        await store_response(
            redis_client, ctx.tenant_id, request.idempotency_key, result.model_dump()
        )
    return result


async def _await_concurrent_caller(ctx: ApplyContext, redis_client: Any, key: str) -> ApplyResponse:
    """Another caller holds the idempotency lock for this key -- wait for it
    to finish and return its cached result rather than re-running the
    pipeline (AC-001-04, concurrent duplicate submissions).
    """
    for _ in range(_POLL_ATTEMPTS):
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)
        cached = await get_cached_response(redis_client, ctx.tenant_id, key)
        if cached is not None:
            return ApplyResponse(**cached)
    raise TimeoutError(f"idempotency lock for {key} was never released")


async def apply_operations_request(
    ctx: ApplyContext, request: ApplyRequest, redis_client: Any
) -> ApplyResponse | ViolationsResponse:
    if not request.idempotency_key:
        return await _apply_uncached(ctx, request)

    cached = await get_cached_response(redis_client, ctx.tenant_id, request.idempotency_key)
    if cached is not None:
        return ApplyResponse(**cached)

    if not await try_acquire_lock(redis_client, ctx.tenant_id, request.idempotency_key):
        return await _await_concurrent_caller(ctx, redis_client, request.idempotency_key)

    try:
        return await _apply_and_cache(ctx, request, redis_client)
    finally:
        await release_lock(redis_client, ctx.tenant_id, request.idempotency_key)
