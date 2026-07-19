# S6 — global search returns zero results for real entities

Tracker: `docs/design/remediation-2-api-gaps.md`. Branch `fix/s6-search-label-predicates`
(off `origin/main`), commits `1d531aaa` (test) then `680d3af9` (fix). Not pushed —
coordinator reviews.

## Root cause

`search/sparql_search.py`'s `build_search_query()` matched only `rdfs:label`. The graph
store has zero `rdfs:label` triples. Real entities carry:

- `https://weave.io/ontology/label` (`weave:label`) — written by every `AddNodeOp` via
  `operations/graph_ops.py::_apply_add_node` (unconditional, one per node).
- `skos:prefLabel` — written additionally on glossary/vocabulary concepts
  (`onboarding/hammerbarn_seed/content.py`'s `_class_node_ops` / `_glossary_node_ops`),
  as a `{"value": ..., "lang": "en"}` property, which can carry different text from
  `weave:label` (a synonym).

## Fix

One-line SPARQL change: the triple pattern in `build_search_query()` now uses a property
path alternation `rdfs:label|skos:prefLabel|weave:label` instead of `rdfs:label` alone.
`rdfs:label` kept for robustness (no current write path emits it, but nothing forbids a
future one). Everything else in the query is unchanged: sanitizer, case-insensitive
`CONTAINS`/`LCASE` filter, `OPTIONAL { ?iri a ?kind }`, `GRAPH ?g` tenant scoping, `LIMIT`.

## Test masking — why the old test passed on dead code

`tests/integration/test_search_tenancy.py`'s main assertion test hand-loaded an
`rdfs:label` triple directly into Oxigraph via `load_graph()`, bypassing the real
node-creation path entirely. That's why it passed while production search returned zero
results for every real entity. Rewrote it to seed through `apply_operations()` (same call
`seed_demo.py` and the `/api/operations/apply` HTTP route make) via a new `_seed_node()`
helper — build an `rdflib.Graph`, `apply_operations(graph, [AddNodeOp(...)])`, serialize to
turtle, `load_graph()`. Confirmed this test FAILS (`total == 0`) against the unfixed query
before the fix landed.

Added a second test proving the `skos:prefLabel` case specifically: an entity whose
`weave:label` ("Fulfillment desk") does **not** contain the search term, but whose
`skos:prefLabel` ("Order") does — a match proves the query actually reads the
`skos:prefLabel` predicate, not a `weave:label` fallback.

## Edge case found (documented, not fixed — out of scope)

`OPTIONAL { ?iri a ?kind }` fans out one result row per `rdf:type` triple on the same
subject. Glossary/vocabulary concepts are OWL/SKOS-punned (`additional_types=[skos:Concept,
owl:Class]` on top of their own `kind`), so a single real entity search-matches as 3
separate result rows (same label, three different `?kind` values). This is pre-existing
behaviour, orthogonal to the label-predicate bug this task fixes — the `skos:prefLabel` test
above asserts "found" (`{label for label in results} == {"Order"}`) rather than
`total == 1` to avoid coupling to that separate issue. Logged here rather than fixed inline
per the "small commits, one logical change" rule; a real fix would be `SELECT DISTINCT ?iri
?label` with `?kind` aggregated (e.g. `GROUP_CONCAT`) or dropped from the OPTIONAL entirely
in favour of a separate per-result kind lookup — needs a product decision on what `kind`
should mean for punned entities, so flagging rather than assuming.

## Tenancy assertions

Preserved, unweakened — all 4 pre-existing tenancy/authz tests still pass unchanged:
`test_search_below_min_length_returns_empty_without_querying_oxigraph`,
`test_search_rejects_non_member_of_workspace`,
`test_search_rejects_foreign_tenant_workspace_id`, `test_search_emits_audit_event`. The
rewritten main test still proves cross-tenant isolation (workspace A's search never returns
workspace B's "Acme Beta" entity).

## Verification

Ran against the slot-1 isolated docker stack (`bash /tmp/weave-stack.sh up 1` /
`down 1`, per repo convention — never touched the primary stack on default ports):

- Before fix: `tests/integration/test_search_tenancy.py -m "integration and docker and not
  stack"` → 2 failed (`total == 0`), 4 passed (untouched tenancy tests).
- After fix: same command → 6 passed. Also ran `tests/unit/test_search.py` (13 tests,
  sanitizer/injection/validate_query coverage, unchanged) alongside — 19 passed total.
- `ruff check` + `mypy` clean on both changed files.

## Note: frontend node_modules was missing in this worktree

Unrelated to this task — this worktree's `packages/frontend` and `packages/shared` had no
`node_modules` at all (fresh worktree, `npm ci` never run), which made the repo's
`make lint` pre-commit hook fail on the frontend leg (`eslint: command not found`), even
though this change touches only `packages/backend`. Ran `npm ci` in both packages to make
the existing hook actually runnable (not skipped, not weakened) rather than bypass it. No
source changes to frontend; commit diffs are backend-only.
