"""CE-BRAND-1 (TASK-003, EPIC-004): `GET /api/brand/tokens` and
`GET /api/brand/voice-rules` -- derived-on-read projections over
`weave:BrandStandard` / `weave:VoiceRule` individuals (ADR-022). Read-only:
writes go through CE-WRITE-1 (`routers/operations.py`) only, never here
(task brief DoD: "no write route exists under `/api/brand/*`").

Version resolution + workspace-scoped auth mirrors `routers/ontology.py`'s
`_resolve_known_version` (same IDOR-safe "resolve to the version's REAL
workspace before authorizing" shape, PR #23 finding #1) -- kept as this
router's own copy rather than an import, matching the rest of the codebase's
per-router convention (each router owns its private auth-glue helpers).
"""

from __future__ import annotations

from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.brand.cache import get_cached, set_cached
from weave_backend.brand.projection import extract_voice_rules, flatten_tokens
from weave_backend.brand.queries import TOKENS_QUERY, VOICE_RULES_QUERY
from weave_backend.db.pool import tenant_connection
from weave_backend.operations import versioning
from weave_backend.rbac import InsufficientRole, enforce_workspace_role
from weave_backend.rdf.oxigraph_client import run_query
from weave_backend.rdf.results import bindings_to_rows
from weave_backend.schemas.brand import TokensResponse, VoiceRule
from weave_backend.tenancy.sessions import get_active_workspace, get_redis
from weave_backend.tenancy.workspaces import Workspace, get_workspace

router = APIRouter(prefix="/api/brand", tags=["brand"])


async def _resolve_workspace_id(principal: Principal, requested: str | None) -> str:
    workspace_id = requested or await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})
    return workspace_id


async def _authorize_read(
    conn: asyncpg.Connection, *, principal: Principal, workspace: Workspace
) -> None:
    try:
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace.id,
            user_sub=principal.sub,
            min_role="read",
        )
    except InsufficientRole as exc:
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type="access.rbac.denied",
                actor_iri=principal.principal_iri,
                subject_iri=workspace.named_graph_iri,
                engine="constitution",
                payload={"required_role": "read"},
            ),
        )
        raise HTTPException(status_code=403, detail={"error": "insufficient_role"}) from exc


async def _resolve_known_version(
    conn: asyncpg.Connection, *, principal: Principal, workspace_id: str, version: str
) -> versioning.GraphVersion:
    """AC-003-07: unknown `?version=` 404s. Resolves to the version's REAL
    workspace before authorizing (see module docstring) -- never trusts the
    caller-supplied `workspace_id` once a literal version_iri is given.
    """
    try:
        version_iri = await versioning.resolve_version(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id, version=version
        )
    except versioning.VersionNotFound as exc:
        raise HTTPException(status_code=404, detail={"error": "version_not_found"}) from exc

    known = await versioning.get_version(
        conn, tenant_id=principal.tenant_id, version_iri=version_iri
    )
    if known is None:
        raise HTTPException(status_code=404, detail={"error": "version_not_found"})

    workspace = await get_workspace(
        conn, tenant_id=principal.tenant_id, workspace_id=known.workspace_id
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail={"error": "version_not_found"})
    await _authorize_read(conn, principal=principal, workspace=workspace)
    return known


async def _resolve_read_version(
    principal: Principal, *, version: str, workspace_id: str | None
) -> versioning.GraphVersion:
    resolved_workspace_id = await _resolve_workspace_id(principal, workspace_id)
    async with tenant_connection(principal.tenant_id) as conn:
        return await _resolve_known_version(
            conn, principal=principal, workspace_id=resolved_workspace_id, version=version
        )


@router.get("/tokens", response_model=TokensResponse)
async def brand_tokens_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    version: str = "latest",
    workspace_id: str | None = Query(default=None),
) -> TokensResponse:
    """AC-003-03: closed-core + extensions token JSON, derived on read from
    `weave:BrandStandard` individuals. Cached per (tenant, version_iri) --
    see `brand/cache.py` module docstring for why that key needs no
    explicit invalidation.
    """
    known = await _resolve_read_version(principal, version=version, workspace_id=workspace_id)
    # ponytail: redis-py stub types get() as bytes|str; decode_responses=True
    # makes it always str at runtime, but that isn't stub-visible (see
    # operations/pipeline.py, which uses the same Any escape hatch).
    redis_client: Any = get_redis()
    cached = await get_cached(
        redis_client, kind="tokens", tenant_id=principal.tenant_id, version_iri=known.version_iri
    )
    if cached is not None:
        return TokensResponse(**cached)

    raw = await run_query(TOKENS_QUERY, known.version_iri)
    rows = bindings_to_rows(raw["results"]["bindings"], ["contentType", "contentBody", "sourceUri"])
    tokens = flatten_tokens(rows)
    await set_cached(
        redis_client,
        kind="tokens",
        tenant_id=principal.tenant_id,
        version_iri=known.version_iri,
        value=tokens,
    )
    return TokensResponse(**tokens)


@router.get("/voice-rules", response_model=list[VoiceRule])
async def brand_voice_rules_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    version: str = "latest",
    workspace_id: str | None = Query(default=None),
) -> list[VoiceRule]:
    """AC-003-04: machine-evaluable VoiceRules, derived on read from
    `weave:VoiceRule` individuals. `humanLabel` is dropped (ADR-022
    decision 4) -- Build's gate only needs `{id, severity, assertion}`.
    """
    known = await _resolve_read_version(principal, version=version, workspace_id=workspace_id)
    # ponytail: redis-py stub types get() as bytes|str; decode_responses=True
    # makes it always str at runtime, but that isn't stub-visible (see
    # operations/pipeline.py, which uses the same Any escape hatch).
    redis_client: Any = get_redis()
    cached = await get_cached(
        redis_client,
        kind="voice-rules",
        tenant_id=principal.tenant_id,
        version_iri=known.version_iri,
    )
    if cached is not None:
        return [VoiceRule.model_validate(rule) for rule in cached]

    raw = await run_query(VOICE_RULES_QUERY, known.version_iri)
    rows = bindings_to_rows(raw["results"]["bindings"], ["ruleId", "severity", "assertion"])
    rules = extract_voice_rules(rows)
    await set_cached(
        redis_client,
        kind="voice-rules",
        tenant_id=principal.tenant_id,
        version_iri=known.version_iri,
        value=rules,
    )
    return [VoiceRule.model_validate(rule) for rule in rules]
