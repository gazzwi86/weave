"""Server-computed graph diff (CE-DIFF-1, AC-002-12/-13).

Deliberately a single unified triple-set model instead of separate
Node/Edge diff types (ADR-002): a literal property change and an edge's
object changing are both "same subject+predicate, exactly one differing
object" -- there's no need for two shapes to express the same rule. A
predicate whose object set changes by more than one value falls back to
plain added/removed pairs rather than a guessed pairing.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from rdflib import Graph

from weave_backend.rdf.oxigraph_client import fetch_graph_turtle


@dataclass(frozen=True)
class Triple:
    subject: str
    predicate: str
    object: str


@dataclass(frozen=True)
class Modification:
    subject: str
    predicate: str
    before: str
    after: str


@dataclass(frozen=True)
class DiffResult:
    added: list[Triple]
    removed: list[Triple]
    modified: list[Modification]


def diff_graphs(before: Graph, after: Graph) -> DiffResult:
    raw_removed = list(before - after)
    raw_added = list(after - before)

    removed_by_key: dict[tuple[str, str], list[object]] = defaultdict(list)
    for s, p, o in raw_removed:
        removed_by_key[(str(s), str(p))].append(o)
    added_by_key: dict[tuple[str, str], list[object]] = defaultdict(list)
    for s, p, o in raw_added:
        added_by_key[(str(s), str(p))].append(o)

    modified: list[Modification] = []
    matched_keys: set[tuple[str, str]] = set()
    for key, removed_objs in removed_by_key.items():
        added_objs = added_by_key.get(key)
        if added_objs and len(removed_objs) == 1 and len(added_objs) == 1:
            subject, predicate = key
            modified.append(
                Modification(
                    subject=subject,
                    predicate=predicate,
                    before=str(removed_objs[0]),
                    after=str(added_objs[0]),
                )
            )
            matched_keys.add(key)

    added = [
        Triple(str(s), str(p), str(o))
        for s, p, o in raw_added
        if (str(s), str(p)) not in matched_keys
    ]
    removed = [
        Triple(str(s), str(p), str(o))
        for s, p, o in raw_removed
        if (str(s), str(p)) not in matched_keys
    ]
    return DiffResult(added=added, removed=removed, modified=modified)


async def compute_diff(from_iri: str, to_iri: str) -> DiffResult:
    """Fetches both version graphs from Oxigraph and diffs them. Existence
    of `from_iri`/`to_iri` as known versions (AC-002-14's 404) is the
    caller's job -- an unknown IRI here just fetches as an empty graph.
    """
    before = Graph()
    before.parse(data=await fetch_graph_turtle(from_iri), format="turtle")
    after = Graph()
    after.parse(data=await fetch_graph_turtle(to_iri), format="turtle")
    return diff_graphs(before, after)
