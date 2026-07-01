---
type: Coding Standard
title: "Semantic Web — SPARQL Query & Update (rdf)"
description: "SPARQL 1.1 SELECT, CONSTRUCT and INSERT/DELETE UPDATE with injection-safe VALUES binding."
tags: [standards, patterns, semantic-web, rdf]
timestamp: 2026-07-01
resource: docs/standards/patterns/semantic-web/sparql-query-update.md
topic: semantic-web
stack: rdf
verification: "rdflib prepareQuery OK for SELECT and CONSTRUCT; rdflib Dataset().update parses and applies the DELETE/INSERT (draft label rewritten as asserted)"
---

# Semantic Web — SPARQL Query & Update (rdf)

SPARQL 1.1 against the RDF store (Oxigraph in dev/test). Read with `SELECT` (tabular) and
`CONSTRUCT` (subgraph projection); mutate the draft graph with a single `DELETE`/`INSERT`/`WHERE`
UPDATE. Caller-supplied values enter **only** through `VALUES` bindings — never via string
interpolation.

**SELECT** — instances of a caller-chosen kind, with labels. `?kind` is bound by the service
layer through the `VALUES` clause, so the request never touches the query text:

```sparql
PREFIX weave: <https://weave.io/ontology/>
PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?process ?label WHERE {
  VALUES ?kind { weave:Process }
  ?process a ?kind ;
           weave:label ?label .
}
ORDER BY ?label
LIMIT 500
```

**CONSTRUCT** — project a process and the actors that perform it into a small subgraph for the
explorer:

```sparql
PREFIX weave: <https://weave.io/ontology/>
PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>

CONSTRUCT {
  ?process a weave:Process ;
           weave:label ?label ;
           weave:performedBy ?actor .
  ?actor a weave:Actor ;
         weave:label ?actorLabel .
}
WHERE {
  VALUES ?process { <https://weave.io/instances/process-invoicing> }
  ?process a weave:Process ;
           weave:label ?label ;
           weave:performedBy ?actor .
  ?actor weave:label ?actorLabel .
}
```

**UPDATE** — rename a process in the draft graph. `wg:draft` resolves to the same IRI as
`weave:graph/draft` (a slash inside a prefixed-name local part is not valid Turtle/SPARQL, so
the graph namespace gets its own prefix). Process IRI and new label arrive as `VALUES` bindings:

```sparql
PREFIX weave: <https://weave.io/ontology/>
PREFIX wg:    <https://weave.io/ontology/graph/>
PREFIX xsd:   <http://www.w3.org/2001/XMLSchema#>

DELETE {
  GRAPH wg:draft {
    ?process weave:label ?oldLabel .
  }
}
INSERT {
  GRAPH wg:draft {
    ?process weave:label ?newLabel .
  }
}
WHERE {
  VALUES ( ?process ?newLabel ) {
    ( <https://weave.io/instances/process-invoicing> "Customer Billing"^^xsd:string )
  }
  GRAPH wg:draft {
    ?process weave:label ?oldLabel .
  }
}
```

**Why.** `SELECT` returns bindings, `CONSTRUCT` returns triples you can splice straight into the
graph explorer, and the `DELETE`/`INSERT`/`WHERE` form is the atomic idiom for a mutation:
remove the old value and add the new one in one operation, guarded by the `WHERE` so it no-ops
when the precondition is absent. Writes target `weave:graph/draft` only; published version
graphs are immutable. Complex queries live in `queries/*.sparql` files, loaded at startup — not
built as Python f-strings.

**Security — SPARQL injection.** Never string-concatenate untrusted input into a query. Bind
values through `VALUES` (or `initBindings` in the driver), which the parser treats as data, so a
hostile string can neither escape its literal nor inject a new pattern (e.g. a `SERVICE` call or
a `DROP GRAPH`). IRIs that must be substituted textually are allowed only after validation
against an allow-list. The read surface is SELECT-only, `SERVICE`-blocked, and paginated; all
mutation goes through the OntologyStore service layer, which emits a PROV-O activity per write —
never issue UPDATE directly from a route handler.

**Anti-patterns.**

- `f"... <{user_iri}> ..."` or `query % value` — the classic injection hole; use `VALUES` /
  `initBindings`.
- Running UPDATE from a route handler, bypassing the OntologyStore and its PROV-O record.
- Writing into a published `weave:graph/<semver>` graph (immutable) instead of the draft.
- An unbounded read query with no `LIMIT` on the paginated read surface.
- A slash in a prefixed-name local part (`weave:graph/draft` as written) — invalid syntax; give
  the graph namespace its own prefix (`wg:draft`) or use a full `<...>` IRI.
