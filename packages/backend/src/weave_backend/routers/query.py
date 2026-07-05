"""CE-TASK-007 E7-S1: `POST /api/query/nl` (natural-language -> SPARQL SELECT,
AC-007-01/-02/-03/-04/-05/-06/-07/-08) and `POST /api/query/explain`
(AC-007-14). Every NL-generated query still passes through the same
`query_rewriter.validate_query` choke point and `_resolve_query_graph`
protocol-level dataset scoping as `routers/sparql.py` -- the model's output
is never trusted as safe to execute.
"""

from __future__ import annotations

import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.nl_query.translator import (
    TranslationFailed,
    explain_empty_result,
    explain_query,
    translate_to_sparql,
)
from weave_backend.rdf.oxigraph_client import run_query
from weave_backend.rdf.query_rewriter import (
    DisallowedQueryError,
    ProhibitedClauseError,
    ServiceBlockedError,
    UnscopedQueryError,
    validate_query,
)
from weave_backend.rdf.results import bindings_to_rows
from weave_backend.routers.sparql import _paginate_bindings, _resolve_query_graph
from weave_backend.schemas.query import (
    ExplainQueryRequest,
    ExplainQueryResponse,
    NlQueryRequest,
    NlQueryResponse,
)

router = APIRouter(prefix="/api/query", tags=["query"])


def _validated_or_translation_failed(sparql_text: str, nl_question: str) -> None:
    """AC-007-02/-05: runs the model's SPARQL through the one sanitiser
    choke point. A structurally prohibited clause (INSERT/DELETE/SERVICE)
    reports its own precise shape; anything else that fails to parse at all
    is the model's fault, not a malicious query, so it collapses to the
    same `translation_failed` shape as an empty translation.
    """
    try:
        validate_query(sparql_text)
    except ProhibitedClauseError as exc:
        raise HTTPException(
            status_code=400, detail={"error": "prohibited_clause", "clause": exc.clause}
        ) from exc
    except ServiceBlockedError as exc:
        raise HTTPException(status_code=400, detail={"error": "service_blocked"}) from exc
    except UnscopedQueryError as exc:
        raise HTTPException(status_code=400, detail={"error": "unscoped_query_rejected"}) from exc
    except DisallowedQueryError as exc:
        raise HTTPException(
            status_code=400, detail={"error": "translation_failed", "nl_question": nl_question}
        ) from exc


@router.post("/nl")
async def nl_query_route(
    body: NlQueryRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> NlQueryResponse:
    started = time.monotonic()
    try:
        sparql_text = translate_to_sparql(body.question)
    except TranslationFailed as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "translation_failed", "nl_question": exc.nl_question},
        ) from exc

    _validated_or_translation_failed(sparql_text, body.question)

    graph_iri = await _resolve_query_graph(
        principal, workspace_id=body.workspace_id, version=body.version
    )
    results = await run_query(sparql_text, graph_iri)
    bindings = results.get("results", {}).get("bindings", [])
    column_names = results.get("head", {}).get("vars", [])
    page_bindings, has_next = _paginate_bindings(bindings, body.page)
    rows = bindings_to_rows(page_bindings, column_names)

    explanation = None
    if not rows:
        explanation = explain_empty_result(body.question, sparql_text)

    return NlQueryResponse(
        sparql_generated=sparql_text,
        rows=rows,
        column_names=column_names,
        elapsed_ms=(time.monotonic() - started) * 1000,
        explanation=explanation,
        next_page=body.page + 1 if has_next else None,
    )


@router.post("/explain")
async def explain_query_route(
    body: ExplainQueryRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ExplainQueryResponse:
    del principal  # AC-007-07: auth required, but explanation isn't scoped by it
    return ExplainQueryResponse(explanation=explain_query(body.sparql))
