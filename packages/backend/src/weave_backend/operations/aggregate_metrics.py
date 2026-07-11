"""CE-METRICS-1 (contracts.md, TASK-007) aggregate computation.

`entity_count_by_kind` is one GROUP BY SELECT against the draft graph, kind
list read in-process from `catalogue.list_kinds()` (AC-007-02 -- the same
source `GET /api/ontology/types` serves, never a hand-copied list).

`draft_published_delta` is computed internally against Oxigraph (never the
CE-DIFF-1 HTTP endpoint -- `operations/diff.py`'s `compute_diff`/
`routers/ontology.py`'s `diff_route`, which only accepts two PUBLISHED
version IRIs and can't take the draft as a side) -- AC-007-04's actual
requirement. It no longer routes through `diff_graphs` (the M1 rdflib diff
core) though: fetching both whole graphs as Turtle and `Graph().parse()`-ing
them client-side was the perf defect found by the AC-007-05 100k-triple
benchmark (cold p95 ~2s, all in the rdflib parse). `_delta_query` computes
the same added/removed/modified *counts* `diff_graphs` would (same
"single-valued (subject, predicate) swap = modified" rule, see
`operations/diff.py`) via SPARQL COUNT/GROUP BY against Oxigraph's own
indexes instead -- see ADR-023.
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from weave_backend.ontology import catalogue
from weave_backend.operations import versioning
from weave_backend.rdf.oxigraph_client import run_query, run_query_multi

_COUNT_QUERY = "SELECT ?kind (COUNT(?s) AS ?count) WHERE { ?s a ?kind } GROUP BY ?kind"

_TOTAL_TRIPLES_QUERY = "SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }"


def _delta_query(*, before_iri: str, after_iri: str) -> str:
    """`?addedRaw`/`?removedRaw` are simple set-difference counts between the
    two named graphs. `?modified` groups the raw added/removed triples by
    (subject, predicate) and counts keys where exactly one object was removed
    and exactly one was added -- `diff_graphs`'s "single-valued property/edge
    swap" rule (`operations/diff.py`), just expressed as SPARQL aggregates
    instead of an in-memory rdflib diff. The three blocks share no
    variables, so they cross-join into a single one-row result (each is
    itself a no-GROUP-BY COUNT, which always returns exactly one row).

    The graph IRIs are interpolated straight into the query text (same
    convention as `requests/ce_read.py::_values_clause`) -- `GRAPH <iri>` has
    no protocol-level parameter, unlike `run_query`'s dataset scoping. Both
    IRIs are internally minted (`workspace.named_graph_iri` / `mint_version`'s
    `f"{{graph}}:v{{semver}}"`), never raw user input.
    """
    before = f"<{before_iri}>"
    after = f"<{after_iri}>"
    return f"""
SELECT ?addedRaw ?removedRaw ?modified WHERE {{
  {{
    SELECT (COUNT(*) AS ?addedRaw) WHERE {{
      GRAPH {after} {{ ?s ?p ?o }}
      FILTER NOT EXISTS {{ GRAPH {before} {{ ?s ?p ?o }} }}
    }}
  }}
  {{
    SELECT (COUNT(*) AS ?removedRaw) WHERE {{
      GRAPH {before} {{ ?s ?p ?o }}
      FILTER NOT EXISTS {{ GRAPH {after} {{ ?s ?p ?o }} }}
    }}
  }}
  {{
    SELECT (COUNT(*) AS ?modified) WHERE {{
      SELECT ?s ?p WHERE {{
        {{
          SELECT ?s ?p (COUNT(DISTINCT ?o) AS ?addedCount) WHERE {{
            GRAPH {after} {{ ?s ?p ?o }}
            FILTER NOT EXISTS {{ GRAPH {before} {{ ?s ?p ?o }} }}
          }} GROUP BY ?s ?p
        }}
        {{
          SELECT ?s ?p (COUNT(DISTINCT ?o) AS ?removedCount) WHERE {{
            GRAPH {before} {{ ?s ?p ?o }}
            FILTER NOT EXISTS {{ GRAPH {after} {{ ?s ?p ?o }} }}
          }} GROUP BY ?s ?p
        }}
        FILTER(?addedCount = 1 && ?removedCount = 1)
      }}
    }}
  }}
}}
"""


@dataclass(frozen=True)
class DeltaCounts:
    added: int
    removed: int
    modified: int


async def entity_count_by_kind(named_graph_iri: str) -> dict[str, int]:
    """AC-007-02/-06: every known BPMO kind defaults to 0 -- an empty graph
    (or one with no instances of some kind) never drops that kind's key.
    """
    kinds = catalogue.list_kinds()
    counts = {kind.label: 0 for kind in kinds}
    label_by_iri = {kind.iri: kind.label for kind in kinds}

    raw = await run_query(_COUNT_QUERY, named_graph_iri)
    for binding in raw.get("results", {}).get("bindings", []):
        label = label_by_iri.get(binding["kind"]["value"])
        if label is not None:
            counts[label] = int(binding["count"]["value"])
    return counts


async def draft_published_delta(
    *, draft_graph_iri: str, latest_published_iri: str | None
) -> DeltaCounts:
    """Implementation Hints pitfall: a never-published tenant
    (`latest_published_iri=None`) diffs the draft against an empty graph, so
    the whole draft counts as `added` -- a plain triple-count query, since an
    empty "before" side means nothing can be removed or modified.

    ADR-023: the published case is a SPARQL count-diff against Oxigraph
    (`_delta_query`), not a `fetch_graph_turtle` + rdflib `diff_graphs` pass
    -- see the module docstring for why.
    """
    if latest_published_iri is None:
        raw = await run_query(_TOTAL_TRIPLES_QUERY, draft_graph_iri)
        added = int(raw["results"]["bindings"][0]["count"]["value"])
        return DeltaCounts(added=added, removed=0, modified=0)

    query = _delta_query(before_iri=latest_published_iri, after_iri=draft_graph_iri)
    raw = await run_query_multi(query, [latest_published_iri, draft_graph_iri])
    binding = raw["results"]["bindings"][0]
    added_raw = int(binding["addedRaw"]["value"])
    removed_raw = int(binding["removedRaw"]["value"])
    modified = int(binding["modified"]["value"])
    return DeltaCounts(
        added=added_raw - modified, removed=removed_raw - modified, modified=modified
    )


async def resolve_latest_version(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> str | None:
    """Implementation Hints pitfall: `latest_version` is `null` for a
    never-published tenant -- `resolve_version`'s `VersionNotFound` maps to
    `None` here rather than propagating as an error.
    """
    try:
        return await versioning.resolve_version(
            conn, tenant_id=tenant_id, workspace_id=workspace_id, version="latest"
        )
    except versioning.VersionNotFound:
        return None
