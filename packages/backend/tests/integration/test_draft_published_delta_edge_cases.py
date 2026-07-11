"""QA edge cases (CE-V1-TASK-007 retry-2 re-QA): `draft_published_delta`'s
SPARQL count-diff (`operations/aggregate_metrics._delta_query`, ADR-023)
against real Oxigraph, checked directly against `operations/diff.py`'s
`diff_graphs` rules -- no HTTP layer, no cache, surgical Turtle fixtures per
case so each rule is isolated instead of mixed together like the seeded-
fixture integration test already does.

Rules being checked (`diff_graphs` docstring + `_delta_query` docstring):
  - never-published (`before` side doesn't exist): whole draft -> added.
  - a (subject, predicate) key with exactly one removed object and exactly
    one added object -> modified=1, NOT added=1+removed=1.
  - empty draft against a non-empty published side -> all removed.
  - identical non-empty graphs -> all zero (not just the trivial empty-vs-
    empty case the existing empty-tenant test covers).
  - a (subject, predicate) key with a multi-valued swap (more than one
    added or removed object) does NOT collapse to `modified` -- falls back
    to plain added/removed, same as `diff_graphs`'s "no guessed pairing"
    rule.
"""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

import pytest

from weave_backend.operations import aggregate_metrics
from weave_backend.rdf.oxigraph_client import load_graph

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _iri(label: str) -> str:
    return f"urn:weave:qa:delta-edge:{label}:{uuid.uuid4().hex[:8]}"


async def _seed(graph_iri: str, turtle: str) -> None:
    await load_graph(graph_iri, turtle)


_PREFIX = "@prefix ex: <urn:weave:qa:delta-edge:ex#> .\n"


async def test_never_published_counts_whole_draft_as_added(platform_stack: Path) -> None:
    draft = _iri("draft")
    await _seed(
        draft,
        _PREFIX + "ex:p1 ex:label \"Invoicing\" .\nex:p1 ex:kind ex:Process .\n",
    )

    result = await aggregate_metrics.draft_published_delta(
        draft_graph_iri=draft, latest_published_iri=None
    )

    assert result.added == 2
    assert result.removed == 0
    assert result.modified == 0


async def test_pure_object_swap_is_modified_not_added_plus_removed(
    platform_stack: Path,
) -> None:
    """A single-valued (subject, predicate) swap in isolation -- no other
    triples changed -- must report modified=1, not added=1 + removed=1.
    """
    before = _iri("before")
    after = _iri("after")
    await _seed(before, _PREFIX + 'ex:p1 ex:label "Invoicing" .\n')
    await _seed(after, _PREFIX + 'ex:p1 ex:label "Invoice Processing" .\n')

    result = await aggregate_metrics.draft_published_delta(
        draft_graph_iri=after, latest_published_iri=before
    )

    assert result == aggregate_metrics.DeltaCounts(added=0, removed=0, modified=1)


async def test_empty_draft_against_non_empty_published_is_all_removed(
    platform_stack: Path,
) -> None:
    before = _iri("before")
    after = _iri("after")
    await _seed(
        before,
        _PREFIX + "ex:p1 ex:label \"Invoicing\" .\nex:p1 ex:kind ex:Process .\n",
    )
    # `after` (the draft) is never written to -- `fetch_graph_turtle`'s own
    # docstring treats an unwritten graph as empty, not an error; a
    # never-written named graph must behave the same as an explicitly
    # emptied one for this delta query.

    result = await aggregate_metrics.draft_published_delta(
        draft_graph_iri=after, latest_published_iri=before
    )

    assert result == aggregate_metrics.DeltaCounts(added=0, removed=2, modified=0)


async def test_identical_non_empty_graphs_are_all_zero(platform_stack: Path) -> None:
    before = _iri("before")
    after = _iri("after")
    turtle = _PREFIX + "ex:p1 ex:label \"Invoicing\" .\nex:p1 ex:kind ex:Process .\n"
    await _seed(before, turtle)
    await _seed(after, turtle)

    result = await aggregate_metrics.draft_published_delta(
        draft_graph_iri=after, latest_published_iri=before
    )

    assert result == aggregate_metrics.DeltaCounts(added=0, removed=0, modified=0)


async def test_multi_valued_swap_does_not_collapse_to_modified(platform_stack: Path) -> None:
    """`diff_graphs`'s "no guessed pairing" rule: a (subject, predicate) key
    where MORE than one object was added or removed must stay as plain
    added/removed counts, never fold into `modified`. Here `ex:p1
    ex:performedBy` drops one value and gains two -- not a 1:1 swap.
    """
    before = _iri("before")
    after = _iri("after")
    await _seed(before, _PREFIX + "ex:p1 ex:performedBy ex:a1 .\n")
    await _seed(
        after,
        _PREFIX + "ex:p1 ex:performedBy ex:a2 .\nex:p1 ex:performedBy ex:a3 .\n",
    )

    result = await aggregate_metrics.draft_published_delta(
        draft_graph_iri=after, latest_published_iri=before
    )

    assert result == aggregate_metrics.DeltaCounts(added=2, removed=1, modified=0)
