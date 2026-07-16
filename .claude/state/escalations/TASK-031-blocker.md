# CE-V1-TASK-031 — AC-3 PROV-O history clause unreachable via CE-READ-1

**Status:** Non-blocking descope, task proceeds. Flagging for architect decision.

## The gap

AC-3 requires the inspector panel to show "PROV-O history" from CE-READ-1
`GET /api/ontology/resource/{iri}`. Verified against the live backend
(`packages/backend/src/weave_backend/routers/ontology.py` line 370,
`ontology/resource.py`, `contracts.md` line 62):

- `GET /api/ontology/resource/{iri}` returns `iri, kind, label, triples,
  outgoing, incoming` — no provenance field. `contracts.md` itself documents
  this endpoint as "a single entity with its properties + edges" — no PROV
  mentioned. The task brief's pseudocode assumed `entity.provenance` exists
  on this response; it does not.
- PROV-O activity records are written to a **separate** named graph
  (`{named_graph_iri}:prov`, `operations/provenance.py`), never merged into
  the entity's own version graph.
- Checked whether `/api/sparql` (also CE-READ-1) could reach the prov graph
  instead: it can't. `oxigraph_client.run_query` pins the SPARQL protocol
  dataset to exactly one `named-graph-uri`/`default-graph-uri` (the resolved
  version graph) per request — the `:prov` graph is never included, so a
  `GRAPH <...:prov> {}` clause in query text simply matches nothing. This is
  a deliberate tenant-isolation choice (`routers/sparql.py` docstring), not
  an oversight.

Same root cause also affects AC-1's table "updated" column — no
per-instance modification timestamp is written into the entity's own
version graph (checked `operations/diff.py`, `ingest_provenance.py`; only
`dcterms:title/format/extent` on ingested-artefact nodes, nothing generic).
The browse table's "updated" column ships as an honest "—" placeholder for
the same reason, not a fabricated value.

## What shipped instead

The inspector panel (AC-3) ships properties + incoming/outgoing edges (both
fully available) and a labelled "History" section showing
`Loading… / not available yet — no CE-READ-1 read path exposes it` rather
than fabricating data or silently dropping the requirement. The AC-to-test
mapping's `test_row_select_opens_inspector_with_props_edges_prov` asserts
this honestly: props + edges render live data; the prov section asserts the
explicit unavailable state, not a fake pass.

## Options for the architect

1. **Accept the descope** — PROV history stays a documented gap until a
   follow-up backend task adds a provenance-lookup endpoint (e.g.
   `GET /api/ontology/resource/{iri}/history` reading the `:prov` graph).
2. **Add the backend endpoint now** — out of scope for this task brief,
   which explicitly states "N/A — no new backend endpoints" in API
   Contracts; would need a new task brief.

Recommendation: option 1. The rest of AC-3 (props, edges, edit entry) and
all other ACs (1,2,4-10) are fully implemented against real contracts.
