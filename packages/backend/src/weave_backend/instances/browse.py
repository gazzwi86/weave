"""E2-S4 browse/search (AC-005-11/-12/-13/-14).

Queries the workspace's live draft graph directly (`named_graph_iri` --
the same graph `operations/pipeline.py::resolve_source_graph_iri` maps
`target == "draft"` to for writes) rather than going through the
version-resolving `GET /api/sparql` surface: there is no "draft" alias on
the read side (only `latest`/published or an explicit version_iri), and the
brief's own design decision says no separate browse endpoint is needed
beyond reusing existing primitives -- this reuses `run_query` the same way
`routers/search.py` (PLAT-TASK-005) already does, just with its own
kind/keyword filters instead of a single free-text label match.
"""

from __future__ import annotations

from typing import Any

from weave_backend.operations.graph_ops import WEAVE
from weave_backend.search.sparql_search import sanitize_search_term

PAGE_SIZE = 50

_LABEL_PREDICATE = f"<{WEAVE.label}>"


def build_browse_query(*, kind: str | None, keyword: str | None, offset: int) -> str:
    """Builds a SELECT-only, single-`GRAPH`-scoped query (satisfies
    `rdf/query_rewriter.py::validate_query`'s structural rules, though this
    query is run directly via `run_query` -- not through the public
    `/api/sparql` surface -- the same choice `search/sparql_search.py`
    already made).

    `kind` and `keyword`, when both given, AND together (AC-005-14). Fetches
    one row beyond `PAGE_SIZE` so `paginate` can detect a next page without
    a second COUNT query.
    """
    clauses = ["?iri a ?kind_iri .", f"?iri {_LABEL_PREDICATE} ?label ."]
    if kind:
        safe_kind = sanitize_search_term(kind)
        clauses.append(f"FILTER(?kind_iri = <{WEAVE[safe_kind]}>)")
    if keyword:
        safe_keyword = sanitize_search_term(keyword)
        clauses.append("?iri ?value_predicate ?value . FILTER(isLiteral(?value))")
        clauses.append(f'FILTER(CONTAINS(LCASE(STR(?value)), LCASE("{safe_keyword}")))')
    where_clause = " ".join(clauses)
    return (
        "SELECT DISTINCT ?iri ?kind_iri ?label WHERE { "
        f"GRAPH ?g {{ {where_clause} }} }} "
        f"ORDER BY LCASE(?label) LIMIT {PAGE_SIZE + 1} OFFSET {offset}"
    )


def paginate(
    rows: list[dict[str, Any]], offset: int
) -> tuple[list[dict[str, Any]], int | None]:
    """Splits an over-fetched (`PAGE_SIZE + 1`-row) result set into one page
    plus the offset of the next page, or `None` once exhausted.
    """
    has_next_page = len(rows) > PAGE_SIZE
    page_rows = rows[:PAGE_SIZE]
    next_offset = offset + PAGE_SIZE if has_next_page else None
    return page_rows, next_offset
