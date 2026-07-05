"""AC-6/AC-7: the only route allowed to talk to Oxigraph. Every query is
rewritten to the caller's active (or explicitly named, still tenant-owned)
workspace's named graph before it's ever sent -- see `rdf/query_rewriter.py`
for the single choke point this depends on.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.operations import diff, versioning
from weave_backend.rbac import enforce_workspace_role
from weave_backend.rdf.oxigraph_client import run_query
from weave_backend.rdf.patterns import NAMED_PATTERNS, ZERO_ROW_MESSAGES
from weave_backend.rdf.query_rewriter import (
    DisallowedQueryError,
    UnscopedQueryError,
    validate_query,
)
from weave_backend.rdf.results import bindings_to_rows
from weave_backend.schemas.sparql import SparqlQueryRequest
from weave_backend.tenancy.sessions import get_active_workspace
from weave_backend.tenancy.workspaces import get_workspace

router = APIRouter(prefix="/api", tags=["sparql"])

#: AC-003-04/-10: at most this many result rows go out per page.
_PAGE_SIZE = 1000


async def _resolve_named_graph(principal: Principal, requested_workspace_id: str | None) -> str:
    """QA FAIL remediation (AC-3): the caller's workspace_id here comes from
    the request body (or the active-session fallback), never a path param,
    so it must be checked against workspace_members explicitly rather than
    via the `require_workspace_role` path-param dependency.
    """
    workspace_id = requested_workspace_id or await get_active_workspace(
        principal.tenant_id, principal.sub
    )
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})
    async with tenant_connection(principal.tenant_id) as conn:
        workspace = await get_workspace(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
        if workspace is None:
            raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace_id,
            user_sub=principal.sub,
            min_role="read",
        )
    return workspace.named_graph_iri


@router.post("/sparql")
async def run_sparql_route(
    body: SparqlQueryRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> dict[str, Any]:
    named_graph_iri = await _resolve_named_graph(principal, body.workspace_id)
    try:
        validate_query(body.query)
    except UnscopedQueryError as exc:
        raise HTTPException(status_code=400, detail={"error": "unscoped_query_rejected"}) from exc
    except DisallowedQueryError as exc:
        raise HTTPException(status_code=400, detail={"error": "disallowed_query"}) from exc

    return await run_query(body.query, named_graph_iri)


async def _resolve_query_graph(
    principal: Principal, *, workspace_id: str | None, version: str
) -> str:
    """AC-003-04/-09 + XT-003: resolves `version` (`"latest"` or an explicit
    version_iri) to the exact named graph to pin the query's dataset against
    at the protocol layer (`run_query`'s `named-graph-uri`/`default-graph-uri`
    params -- never a query-text rewrite, see `rdf/query_rewriter.py`).

    404s (never 403) on an unknown version -- AC-003-08/XT-003: a foreign-
    tenant version_iri is tenant-scoped at the SQL layer in
    `versioning.get_version`, so it simply never resolves here, closing the
    same cross-tenant leak class the PR #28 `run_query_unscoped` finding
    flagged. The read is authorized against the version's REAL owning
    workspace (`known.workspace_id`), never the caller-supplied one -- same
    IDOR-safe pattern as `routers/ontology.py::_resolve_known_version`.
    """
    resolved_workspace_id = workspace_id or await get_active_workspace(
        principal.tenant_id, principal.sub
    )
    if resolved_workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})

    async with tenant_connection(principal.tenant_id) as conn:
        try:
            resolved_version_iri = await versioning.resolve_version(
                conn,
                tenant_id=principal.tenant_id,
                workspace_id=resolved_workspace_id,
                version=version,
            )
        except versioning.VersionNotFound as exc:
            raise HTTPException(status_code=404, detail={"error": "version_not_found"}) from exc

        known = await versioning.get_version(
            conn, tenant_id=principal.tenant_id, version_iri=resolved_version_iri
        )
        if known is None:
            raise HTTPException(status_code=404, detail={"error": "version_not_found"})

        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=known.workspace_id,
            user_sub=principal.sub,
            min_role="read",
        )
    return known.version_iri


def _paginate_bindings(
    bindings: list[dict[str, Any]], page: int
) -> tuple[list[dict[str, Any]], bool]:
    """AC-003-04/-10: slices `bindings` to `page` (1-indexed, `_PAGE_SIZE`
    rows), and reports whether a further page remains.
    """
    start = (page - 1) * _PAGE_SIZE
    page_bindings = bindings[start : start + _PAGE_SIZE]
    has_next = start + _PAGE_SIZE < len(bindings)
    return page_bindings, has_next


def _resolve_pattern_query(pattern: str) -> str:
    """AC-007-12: `pattern=` names a stored SELECT (`rdf/patterns.py`) --
    never arbitrary text -- so an unrecognised name is a 400, not a KeyError.
    """
    try:
        return NAMED_PATTERNS[pattern]
    except KeyError as exc:
        raise HTTPException(status_code=400, detail={"error": "unknown_pattern"}) from exc


async def _pattern_response(
    principal: Principal, *, pattern: str, workspace_id: str | None, version: str
) -> dict[str, Any]:
    """AC-007-10/-12/-13: stored patterns still pass through
    `validate_query` (the one choke point, ADR-005 #2) and the same
    version-pinned graph resolution as `query=` -- only the response shape
    differs (`{rows, column_names, message?}, ADR-005 #3), matching what
    the NL query endpoint (`routers/query.py`) also returns.
    """
    query_text = _resolve_pattern_query(pattern)
    validate_query(query_text)
    graph_iri = await _resolve_query_graph(principal, workspace_id=workspace_id, version=version)
    results = await run_query(query_text, graph_iri)
    column_names = results.get("head", {}).get("vars", [])
    rows = bindings_to_rows(results.get("results", {}).get("bindings", []), column_names)
    body: dict[str, Any] = {"rows": rows, "column_names": column_names}
    if not rows:
        body["message"] = ZERO_ROW_MESSAGES.get(pattern, "No results found")
    return body


async def _since_version_response(
    principal: Principal, *, workspace_id: str | None, version: str, since_version: str
) -> dict[str, Any]:
    """AC-003-15: CE-EVENT-1's polling fallback -- a diff between
    `since_version` and `version` (default `"latest"`), instead of running a
    query. Both endpoints go through `_resolve_query_graph`, so an unknown or
    foreign-tenant `since_version`/`version` 404s the same way a query would.
    """
    from_version_iri = await _resolve_query_graph(
        principal, workspace_id=workspace_id, version=since_version
    )
    to_version_iri = await _resolve_query_graph(
        principal, workspace_id=workspace_id, version=version
    )
    result = await diff.compute_diff(from_version_iri, to_version_iri)
    return {
        "since_version": from_version_iri,
        "version_iri": to_version_iri,
        "added": [
            {"subject": t.subject, "predicate": t.predicate, "object": t.object}
            for t in result.added
        ],
        "removed": [
            {"subject": t.subject, "predicate": t.predicate, "object": t.object}
            for t in result.removed
        ],
        "modified": [
            {"subject": m.subject, "predicate": m.predicate, "before": m.before, "after": m.after}
            for m in result.modified
        ],
    }


@dataclass(frozen=True)
class SparqlQueryParams:
    """Groups the GET route's query params behind one `Depends()` -- Law E's
    5-param cap otherwise falls to a raw `query`/`version`/`page`/
    `workspace_id`/`since_version` + `principal`/`response` count of 7.
    """

    query: str | None
    version: str
    page: int
    workspace_id: str | None
    since_version: str | None


def _sparql_query_params(
    query: str | None = Query(default=None),
    version: str = Query(default="latest"),
    page: int = Query(default=1, ge=1),
    workspace_id: str | None = Query(default=None),
    since_version: str | None = Query(default=None),
) -> SparqlQueryParams:
    return SparqlQueryParams(
        query=query,
        version=version,
        page=page,
        workspace_id=workspace_id,
        since_version=since_version,
    )


@router.get("/sparql")
async def sparql_select_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    response: Response,
    params: Annotated[SparqlQueryParams, Depends(_sparql_query_params)],
    pattern: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    """CE-READ-1: AC-003-04 (paginated SELECT-only reads), AC-003-09 (404 on
    an unknown version), AC-003-10 (`Link: rel="next"` past 1000 rows),
    AC-003-15 (`since_version` polling fallback returns a diff instead),
    AC-007-12 (`pattern=` runs a named stored query instead of `query=`).
    """
    if pattern is not None:
        return await _pattern_response(
            principal, pattern=pattern, workspace_id=params.workspace_id, version=params.version
        )

    if params.since_version is not None:
        return await _since_version_response(
            principal,
            workspace_id=params.workspace_id,
            version=params.version,
            since_version=params.since_version,
        )

    if not params.query:
        raise HTTPException(status_code=400, detail={"error": "query_required"})

    try:
        validate_query(params.query)
    except UnscopedQueryError as exc:
        raise HTTPException(status_code=400, detail={"error": "unscoped_query_rejected"}) from exc
    except DisallowedQueryError as exc:
        raise HTTPException(status_code=400, detail={"error": "disallowed_query"}) from exc

    graph_iri = await _resolve_query_graph(
        principal, workspace_id=params.workspace_id, version=params.version
    )
    results = await run_query(params.query, graph_iri)
    bindings = results.get("results", {}).get("bindings", [])
    page_bindings, has_next = _paginate_bindings(bindings, params.page)
    if has_next:
        next_page_url = "/api/sparql?" + urlencode(
            {"query": params.query, "version": params.version, "page": params.page + 1}
        )
        response.headers["Link"] = f'<{next_page_url}>; rel="next"'

    return {
        "version_iri": graph_iri,
        "page": params.page,
        "head": results.get("head", {}),
        "results": {"bindings": page_bindings},
    }
