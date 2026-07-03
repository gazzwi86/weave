"""PLAT-TASK-005 AC-3: search-query building + sanitisation, unit-level
(pure functions, no network -- see tests/integration/test_search.py for the
real-Oxigraph tenant-scoping proof).
"""

from __future__ import annotations

import contextlib

import pytest

from weave_backend.rdf.query_rewriter import (
    DisallowedQueryError,
    UnscopedQueryError,
    validate_query,
)
from weave_backend.search.sparql_search import (
    MIN_QUERY_LENGTH,
    build_search_query,
    sanitize_search_term,
)


def test_sanitize_search_term_strips_sparql_injection_characters() -> None:
    """Law 13: `< > " { } ;` are stripped before the term ever reaches the
    query text -- these are exactly the characters that could close the
    `"..."` string literal (`"`) or open a new clause (`<>`, `{}`, `;`).
    """
    assert sanitize_search_term('a<b>c"d{e}f;g') == "abcdefg"


def test_sanitize_search_term_leaves_ordinary_text_untouched() -> None:
    assert sanitize_search_term("Acme Corp v2.1") == "Acme Corp v2.1"


def test_build_search_query_disarms_bracketed_iri_injection() -> None:
    """A malicious term trying to close the string literal and splice in a
    second GRAPH clause naming an attacker-chosen graph can't survive: the
    bracket-delimited IRI-reference form is gone (stripped), so it can only
    ever land as inert text still inside the one literal we control.
    """
    injection = '" } GRAPH <urn:weave:tenant:other:ws:evil> { ?s ?p ?o FILTER(true'
    query = build_search_query(injection)

    validate_query(query)  # still one ordinary, well-formed GRAPH-scoped query
    assert "<urn:weave:tenant:other:ws:evil>" not in query
    assert sanitize_search_term(injection) in query


def test_build_search_query_embeds_case_insensitive_contains_filter() -> None:
    query = build_search_query("acme")
    assert "LCASE" in query
    assert "CONTAINS" in query


def test_min_query_length_is_two() -> None:
    assert MIN_QUERY_LENGTH == 2


# QA edge case (PLAT-TASK-005 checklist item 3): adversarially try to break
# the sanitiser with payloads shaped like real SPARQL attacks (federation,
# update, cross-graph union). Every one must either land as inert text still
# inside the one FILTER string literal we control (validate_query still
# passes, but the attacker's clause text is gone) or fail to parse at all
# (rejected) -- never a query that actually runs a second clause, a SERVICE
# call, or an UPDATE.
@pytest.mark.parametrize(
    "payload",
    [
        'Payment") } UNION { ?s ?p ?o ',
        'x" } SERVICE <http://evil.example/sparql> { ?s ?p ?o } #',
        'x" }; INSERT DATA { <urn:evil> <urn:p> "pwned" } ; SELECT * WHERE { GRAPH ?g { #',
        'x" } FROM <urn:weave:tenant:other> WHERE { ?s ?p ?o } #',
        '"; DROP GRAPH <urn:weave:tenant:victim> ;',
    ],
)
def test_search_sanitizes_adversarial_injection_payloads(payload: str) -> None:
    query = build_search_query(payload)

    # The characters that could close our string literal or open a new
    # clause (`< > " { } ;`) never survive sanitisation.
    for char in '<>"{};':
        assert char not in sanitize_search_term(payload)

    # The payload's own bracket-delimited IRI reference can't survive
    # (`<`/`>` are stripped from the *term*, not the query's own fixed
    # rdfs: PREFIX declaration) -- so the attacker's graph/service IRI can
    # never be reconstructed as a real IRI-ref, only as inert text sitting
    # inside our one FILTER string. validate_query's own job is exactly to
    # catch a real SERVICE/dataset/UPDATE clause; whatever it decides here
    # (accept the now-inert single SELECT, or reject unparseable leftovers)
    # is safe.
    assert sanitize_search_term(payload) in query
    with contextlib.suppress(DisallowedQueryError, UnscopedQueryError):
        validate_query(query)  # either accepted (now-inert) or rejected -- both safe
