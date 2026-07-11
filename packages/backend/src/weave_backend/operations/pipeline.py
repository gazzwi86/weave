"""CE-WRITE-1 orchestration: clone -> apply -> validate -> commit/discard.

Flow (see task brief diagram): auth/RBAC happen in the router before this
module is ever called. From here: idempotency check -> clone working graph
-> apply ops -> SHACL validate -> violation? discard+422 : commit new
version + promote working graph.

AC-001-10 (rollback): every failable step -- the version-row insert, the
version-graph snapshot PUT, the PROV activity, the audit entry -- happens
in `_commit`, *before* the working-graph promotion in `_apply_uncached`.
Promotion is the last, irreversible step: if anything above it fails, the
Postgres transaction (version row + audit entry) rolls back and promotion
never ran, so the working graph is untouched; if promotion itself fails,
it raises inside the same transaction and everything rolls back with it.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from typing import Any

import asyncpg
from rdflib import Graph

from weave_backend.audit.emitter import AuditEvent
from weave_backend.authoring.bpmo import validate_kind
from weave_backend.operations import metrics
from weave_backend.operations.graph_ops import apply_operations
from weave_backend.operations.idempotency import (
    LOCK_TTL_SECONDS,
    get_cached_response,
    release_lock,
    store_response,
    try_acquire_lock,
)
from weave_backend.operations.outbox import enqueue
from weave_backend.operations.provenance import ActorType, write_activity
from weave_backend.operations.shacl import validate_graph_for_tenant
from weave_backend.operations.versioning import get_version, mint_version
from weave_backend.rdf.oxigraph_client import fetch_graph_ntriples, load_graph
from weave_backend.schemas.operations import (
    AddNodeOp,
    ApplyRequest,
    ApplyResponse,
    ViolationDetail,
    ViolationsResponse,
)

_POLL_INTERVAL_SECONDS = 0.05
#: Poll no longer than the lock itself can live -- past this, the first
#: caller's process is presumed dead, not just slow.
_POLL_ATTEMPTS = int(LOCK_TTL_SECONDS / _POLL_INTERVAL_SECONDS)

#: Cache-entry discriminator (Fix 2): idempotent replay must return the
#: *same* outcome, 422 included -- not just re-wrap whatever's cached as a
#: 201.
_CACHE_KIND_APPLY = "apply"
_CACHE_KIND_VIOLATIONS = "violations"

#: Shape of a real (if foreign) version_iri, per `versioning.mint_version`:
#: `urn:weave:tenant:{tenant_id}:ws:{workspace_id}:v{semver}`. Used only to
#: distinguish a forged cross-tenant/cross-workspace target (well-formed,
#: 403 + audit -- ADR-001-tenant-isolation) from a genuinely malformed one
#: (400, no audit).
_VERSION_IRI_RE = re.compile(r"^urn:weave:tenant:[^:]+:ws:[^:]+:v\d+\.\d+\.\d+$")


class InvalidTargetError(Exception):
    """`target` isn't a recognisable graph reference at all -- malformed,
    not a forgery attempt. 400, no audit.
    """


class ForeignTargetError(Exception):
    """`target` is a well-formed version IRI naming a graph outside the
    caller's own workspace (AC-001-09). ADR-001-tenant-isolation: "a payload
    naming another tenant's graph is a 403 + audit", never a 400.
    """


class PublishedTargetError(Exception):
    """AC-003-13: `target` names a real version_iri in the caller's own
    workspace, but that version is already published -- published versions
    are immutable snapshots (AC-002-09's same rule, enforced here for the
    mutation side too), so applying against one is rejected rather than
    silently re-derived from it.
    """


@dataclass
class ApplyContext:
    tenant_id: str
    workspace_id: str
    named_graph_iri: str
    conn: asyncpg.Connection
    #: JWT-authenticated principal (never the client-supplied `request.actor`
    #: body field) -- the only trustworthy actor for PROV attribution and the
    #: audit trail (PR #20 finding: spoofable attribution).
    principal_iri: str
    #: "human" for every mutation today (no LLM-agent-initiated flow until
    #: TASK-004/006) -- carried on the context so `write_activity` can model
    #: the PROV-O actor type correctly once that flow exists (ADR-002).
    principal_type: ActorType = "human"


def resolve_source_graph_iri(named_graph_iri: str, target: str) -> str:
    if target == "draft":
        return named_graph_iri
    if target.startswith(f"{named_graph_iri}:v"):
        return target
    if _VERSION_IRI_RE.match(target):
        raise ForeignTargetError(target)
    raise InvalidTargetError(target)


async def _fetch_scratch_graph(source_graph_iri: str) -> Graph:
    # ce-perf: N-Triples clone+parse, not Turtle -- Turtle's qname/prefix
    # computation was the dominant write-path cost (see ADR-004 follow-up).
    ntriples = await fetch_graph_ntriples(source_graph_iri)
    graph = Graph()
    if ntriples:
        graph.parse(data=ntriples, format="nt")
    return graph


async def _commit(
    ctx: ApplyContext,
    scratch: Graph,
    *,
    source_graph_iri: str,
    claimed_actor_iri: str,
    applied_count: int,
) -> tuple[str, str, str]:
    """Mints the version row, the version-graph snapshot, the PROV activity,
    and the audit outbox entry -- everything failable, all before the caller
    promotes the working graph (AC-001-10, see module docstring).

    The audit write is a same-transaction `enqueue` (a cheap outbox insert),
    not the real hash-chain emit -- see `operations/outbox.py`'s docstring
    and ADR-002. AC-002-04: real delivery happens later, out of this
    transaction, so a down audit sink can never roll back the mutation.

    Returns `(version_iri, activity_iri, body)` -- `body` is N-Triples, not
    Turtle (ce-perf: avoids rdflib's Turtle qname/prefix cost, see
    `_fetch_scratch_graph`). The caller does the final
    `load_graph(ctx.named_graph_iri, body, content_type="application/n-triples")`
    promotion itself, deliberately last. Note: the version-graph PUT below
    runs before the Postgres transaction commits -- if promotion never
    happens, that PUT is an orphan (no `graph_versions` row survives to
    reference it), invisible to the registry. Acceptable residue, not a
    divergence.
    """
    version_iri, _semver = await mint_version(
        ctx.conn,
        tenant_id=ctx.tenant_id,
        workspace_id=ctx.workspace_id,
        named_graph_iri=ctx.named_graph_iri,
        actor_iri=ctx.principal_iri,
    )
    body = scratch.serialize(format="nt")
    await load_graph(version_iri, body, content_type="application/n-triples")
    activity_iri = await write_activity(
        named_graph_iri=ctx.named_graph_iri,
        actor_iri=ctx.principal_iri,
        actor_type=ctx.principal_type,
        generated_iri=version_iri,
        used_iri=source_graph_iri,
    )
    await enqueue(
        ctx.conn,
        AuditEvent(
            tenant_id=ctx.tenant_id,
            event_type="operations.applied",
            actor_iri=ctx.principal_iri,
            subject_iri=version_iri,
            engine="constitution",
            payload={
                "target_graph_iri": ctx.named_graph_iri,
                "activity_iri": activity_iri,
                "applied_count": applied_count,
                #: Client-claimed actor (ApplyRequest.actor) -- descriptive
                #: only, never trusted for attribution. Kept here so a
                #: mismatch with `actor_principal_iri` above is visible in
                #: the audit trail rather than silently dropped.
                "claimed_actor_iri": claimed_actor_iri,
            },
        ),
    )
    return version_iri, activity_iri, body


def _to_violation_detail(result: Any) -> ViolationDetail:
    return ViolationDetail(
        focus_node=result.focus_node,
        path=result.path,
        severity=result.severity,
        message=result.message,
    )


async def _apply_uncached(
    ctx: ApplyContext, request: ApplyRequest, redis_client: Any = None
) -> ApplyResponse | ViolationsResponse:
    # TASK-004 AC-004-02: every add_node's kind must be one of the 13 BPMO
    # kinds. Checked here -- the one place every authoring surface (NL,
    # form, import, and a raw POST /api/operations/apply caller) routes
    # through -- rather than in each caller, so there's no bypass path.
    # Pure input validation, so it runs before any DB/graph I/O.
    #
    # An absolute-IRI kind (e.g. "http://www.w3.org/2002/07/owl#Restriction")
    # is OWL/RDFS vocabulary, not a BPMO business kind -- graph_ops._expand()
    # already passes these through untouched for AC-004-06/-07's restriction/
    # disjointness authoring, so the guard mirrors that same distinction.
    for op in request.operations:
        if isinstance(op, AddNodeOp) and "://" not in op.kind:
            validate_kind(op.kind)

    source_graph_iri = resolve_source_graph_iri(ctx.named_graph_iri, request.target)
    if request.target != "draft":
        target_version = await get_version(
            ctx.conn, tenant_id=ctx.tenant_id, version_iri=request.target
        )
        if target_version is not None and target_version.status == "published":
            raise PublishedTargetError(request.target)
    scratch = await _fetch_scratch_graph(source_graph_iri)
    apply_result = apply_operations(scratch, request.operations)
    # CE-TASK-005: tenant-scoped shapes -- redis_client=None (idempotency-
    # less callers/tests, see module Any-typed param) degrades to the
    # framework-only M1 behaviour, same as before this task.
    shacl_results = await validate_graph_for_tenant(
        scratch, tenant_id=ctx.tenant_id, redis_client=redis_client
    )
    violations = [r for r in shacl_results if r.severity == "Violation"]

    if violations:
        metrics.schedule_mutation_outcome_metric("violation")
        return ViolationsResponse(violations=[_to_violation_detail(r) for r in violations])

    version_iri, activity_iri, body = await _commit(
        ctx,
        scratch,
        source_graph_iri=source_graph_iri,
        claimed_actor_iri=request.actor,
        applied_count=apply_result.applied_count,
    )
    metrics.schedule_mutation_outcome_metric("success")
    # Last, irreversible step -- everything failable already happened and
    # committed (or would roll back) above; see module docstring.
    await load_graph(ctx.named_graph_iri, body, content_type="application/n-triples")
    advisories = [_to_violation_detail(r) for r in shacl_results if r.severity != "Violation"]
    return ApplyResponse(
        activity_iri=activity_iri,
        applied_count=apply_result.applied_count,
        version_iri=version_iri,
        advisories=advisories,
        ref_map=apply_result.ref_map,
    )


def _to_cache_entry(result: ApplyResponse | ViolationsResponse) -> dict[str, Any]:
    kind = _CACHE_KIND_APPLY if isinstance(result, ApplyResponse) else _CACHE_KIND_VIOLATIONS
    return {"kind": kind, "body": result.model_dump()}


def _from_cache_entry(cached: dict[str, Any]) -> ApplyResponse | ViolationsResponse:
    if cached["kind"] == _CACHE_KIND_VIOLATIONS:
        return ViolationsResponse(**cached["body"])
    return ApplyResponse(**cached["body"])


async def _apply_and_cache(
    ctx: ApplyContext, request: ApplyRequest, redis_client: Any
) -> ApplyResponse | ViolationsResponse:
    result = await _apply_uncached(ctx, request, redis_client)
    if request.idempotency_key:
        await store_response(
            redis_client, ctx.tenant_id, request.idempotency_key, _to_cache_entry(result)
        )
    return result


async def _await_concurrent_caller(
    ctx: ApplyContext, redis_client: Any, key: str
) -> ApplyResponse | ViolationsResponse:
    """Another caller holds the idempotency lock for this key -- wait for it
    to finish and return its cached result rather than re-running the
    pipeline (AC-001-04, concurrent duplicate submissions).
    """
    for _ in range(_POLL_ATTEMPTS):
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)
        cached = await get_cached_response(redis_client, ctx.tenant_id, key)
        if cached is not None:
            return _from_cache_entry(cached)
    # The first caller's process is presumed dead (poll window == lock TTL,
    # see module docstring) -- the router maps this to a 409, not a 500.
    raise TimeoutError(f"idempotency lock for {key} was never released")


async def apply_operations_request(
    ctx: ApplyContext, request: ApplyRequest, redis_client: Any
) -> ApplyResponse | ViolationsResponse:
    if not request.idempotency_key:
        return await _apply_uncached(ctx, request, redis_client)

    cached = await get_cached_response(redis_client, ctx.tenant_id, request.idempotency_key)
    if cached is not None:
        return _from_cache_entry(cached)

    if not await try_acquire_lock(redis_client, ctx.tenant_id, request.idempotency_key):
        return await _await_concurrent_caller(ctx, redis_client, request.idempotency_key)

    try:
        return await _apply_and_cache(ctx, request, redis_client)
    finally:
        await release_lock(redis_client, ctx.tenant_id, request.idempotency_key)
