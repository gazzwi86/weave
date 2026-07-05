"""AC-005-11/-12/-13/-14: browse/search query-building + pagination is pure
and unit-tested here; actual execution semantics (does the built query
really filter/order/paginate against a live graph) is proven at the
integration level in `tests/integration/test_instances.py`.
"""

from __future__ import annotations

from weave_backend.instances.browse import PAGE_SIZE, build_browse_query, paginate


def test_page_size_is_fifty() -> None:
    assert PAGE_SIZE == 50


def test_build_browse_query_with_no_filters_has_no_kind_or_keyword_clause() -> None:
    query = build_browse_query(kind=None, keyword=None, offset=0)
    assert "FILTER(?kind_iri" not in query
    assert "CONTAINS" not in query


def test_build_browse_query_filters_by_kind() -> None:
    query = build_browse_query(kind="Process", keyword=None, offset=0)
    assert "https://weave.io/ontology/Process" in query


def test_build_browse_query_filters_by_keyword_case_insensitively() -> None:
    query = build_browse_query(kind=None, keyword="onboarding", offset=0)
    assert "CONTAINS(LCASE(STR(?value)), LCASE(" in query
    assert "onboarding" in query


def test_build_browse_query_ands_kind_and_keyword_when_both_given() -> None:
    """AC-005-14: kind and keyword filters must both be present -- not one
    replacing the other.
    """
    query = build_browse_query(kind="Process", keyword="onboarding", offset=0)
    assert "https://weave.io/ontology/Process" in query
    assert "onboarding" in query


def test_build_browse_query_orders_by_label() -> None:
    query = build_browse_query(kind=None, keyword=None, offset=0)
    assert "ORDER BY LCASE(?label)" in query


def test_build_browse_query_paginates_with_limit_and_offset() -> None:
    query = build_browse_query(kind=None, keyword=None, offset=100)
    assert f"LIMIT {PAGE_SIZE + 1}" in query
    assert "OFFSET 100" in query


def test_build_browse_query_sanitizes_unsafe_keyword_characters() -> None:
    """Reuses `search.sparql_search.sanitize_search_term` -- Law 13, never
    concatenate untrusted input into the SPARQL string unescaped.
    """
    query = build_browse_query(kind=None, keyword='a"; DROP {}', offset=0)
    contains_clause = query.split("FILTER(CONTAINS", 1)[1]
    assert '"' not in contains_clause.split('LCASE("', 1)[1].split('"')[0]
    assert "{" not in contains_clause
    assert ";" not in contains_clause


def test_build_browse_query_sanitizes_unsafe_kind_characters() -> None:
    """Law 13: `kind` must be sanitised the same way `keyword` is before it
    goes into the query -- a crafted value must not break out of the `<...>`
    IRI ref it's embedded in and inject query text.
    """
    query = build_browse_query(kind="Process>}{DROP", keyword=None, offset=0)
    assert "https://weave.io/ontology/ProcessDROP>" in query
    assert "}{DROP" not in query


def test_paginate_returns_no_next_page_when_under_page_size() -> None:
    rows = [{"iri": {"value": f"n{i}"}} for i in range(10)]
    page, next_cursor = paginate(rows, offset=0)
    assert len(page) == 10
    assert next_cursor is None


def test_paginate_returns_next_cursor_when_a_next_page_exists() -> None:
    """`build_browse_query` over-fetches by one row (`PAGE_SIZE + 1`) so
    `paginate` can tell a next page exists without a second COUNT query.
    """
    rows = [{"iri": {"value": f"n{i}"}} for i in range(PAGE_SIZE + 1)]
    page, next_cursor = paginate(rows, offset=0)
    assert len(page) == PAGE_SIZE
    assert next_cursor == PAGE_SIZE


def test_paginate_advances_cursor_from_a_nonzero_offset() -> None:
    rows = [{"iri": {"value": f"n{i}"}} for i in range(PAGE_SIZE + 1)]
    _page, next_cursor = paginate(rows, offset=50)
    assert next_cursor == 100
