# Weave — Tree of Thought & Action

> A living document. It is expanded after each task is better understood
> (following an experiment, prototype, visual inspection, or test run).
> Last updated: 2026-06-14.

## 0. Vision

Weave is a web platform for **building, curating, and visualising detailed
ontologies / knowledge graphs**. It is built on open semantic-web standards
(RDF, RDFS, OWL, SKOS, PROV, Turtle) and lets a user grow the graph two ways:

1. **By hand** — IcePanel/C4-style UI forms and a draggable modelling canvas.
2. **By language** — describe a change in natural language and let an LLM
   (Claude) translate it into valid RDF mutations.

The graph is rendered as a **rich, colourful, interactive** picture with
**labelled, annotatable relationships**. Nodes and edges carry comments,
notes, and structured detail. Terms can be associated with **business
domains**, **business capabilities**, and **data schemas**, and the platform
can produce a **service inventory** and a **glossary**.

## 1. Decisions locked (round 1)

| Decision | Choice | Rationale |
|---|---|---|
| First milestone | Vertical slice: viz + CRUD | Tangible, clickable feedback fast |
| Primary canvas | Dual-mode (Cytoscape + React Flow) | Explore vs. model intents |
| Ontology store | Embedded triple store (Oxigraph) | SPARQL + TTL, self-contained |
| LLM | Anthropic Claude, server-side, tool-use | Best structured-RDF quality |

## 2. Hypotheses about wants / needs / downstream impact

- **H1 — Two minds, one graph.** Users exploring ("what connects to what?")
  want physics/force layout and colour-by-type. Users modelling ("document
  this system landscape") want stable, draggable, orthogonal C4 diagrams.
  Backing both with a single RDF graph avoids divergence. *Impact:* the API
  must return a layout-agnostic node/edge model; layout lives in the client.
- **H2 — Provenance matters.** If an LLM is mutating the graph, users will not
  trust it unless every change is attributable and reversible. *Impact:* use
  PROV-O to stamp who/what/when on every mutation; return a diff for review.
- **H3 — Edges are first-class.** "Labelled connections with comments/notes"
  means relationships need identity and annotations, not just bare triples.
  *Impact:* support reified annotations on relationships.
- **H4 — Open & portable wins.** Turtle import/export at any time means no
  lock-in; the graph is git-diffable and survives the tool. *Impact:* TTL is
  a first-class interchange format, not an afterthought.
- **H5 — Schema → ontology is the bridge to data.** Uploading a schema and
  associating it with concepts is the on-ramp to live data sources
  (Databricks/Snowflake) later. *Impact:* model `weave:DataAsset` /
  `weave:Field` now so the connectors plug in later.

## 3. Architecture (current)

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (React + TS + Vite)                             │
│  • Explore canvas  (Cytoscape.js, force-directed)        │
│  • Model canvas    (React Flow, C4 / IcePanel-style)     │
│  • Inspector / forms / LLM prompt bar                    │
│  • TanStack Query for server state                       │
└───────────────▲──────────────────────────────┬──────────┘
                │ REST/JSON                      │
┌───────────────┴──────────────────────────────▼──────────┐
│ Backend (FastAPI, Python 3.11)                           │
│  • OntologyStore  (pyoxigraph: SPARQL + TTL)             │
│  • LLM service    (Anthropic Claude, tool-use → RDF)     │
│  • PROV stamping, graph→JSON projection                  │
└───────────────┬──────────────────────────────────────────┘
                │
        ┌───────▼────────┐
        │ Oxigraph store │  (on-disk, TTL import/export)
        └────────────────┘
```

## 4. Ontology model (`https://weave.dev/ontology#`, prefix `weave:`)

- Node kinds: `owl:Class`, `skos:Concept`, `weave:System`, `weave:Service`,
  `weave:BusinessDomain`, `weave:BusinessCapability`, `weave:DataAsset`,
  `weave:Field`.
- Common props: `rdfs:label`, `rdfs:comment` / `skos:definition`,
  `weave:note`, `weave:color`, `prov:wasGeneratedBy`, `dcterms:created`.
- Relationships: direct triples `s p o`. When an edge carries a
  comment/note, a companion `rdf:Statement` reifies it and holds the
  annotations. Common predicates seeded: `skos:broader`, `skos:narrower`,
  `skos:related`, `weave:dependsOn`, `weave:partOf`, `weave:realizes`,
  `weave:owns`, `weave:exposes`, `weave:describes`.

## 5. Build plan (milestone 1 — vertical slice)

- [x] T1 Repo scaffold, docs, meta files
- [ ] T2 Backend: OntologyStore + API + tests
- [ ] T3 Backend: Claude LLM mutate endpoint (tool-use) + mocked test
- [ ] T4 Frontend: app shell, API client, TanStack Query
- [ ] T5 Frontend: Explore canvas (Cytoscape) colour-by-type, labelled edges
- [ ] T6 Frontend: Model canvas (React Flow) draggable + labelled edges
- [ ] T7 Frontend: Inspector + add/edit node & edge forms
- [ ] T8 Frontend: LLM prompt bar wired to mutate endpoint
- [ ] T9 Docker (backend, frontend) + docker-compose
- [ ] T10 CI: PR workflow (lint, types, unit, complexity) + main (build/deploy)
- [ ] T11 Terraform skeleton (AWS, account TBD)
- [ ] T12 E2E (Playwright), visual, Lighthouse, complexity gates seeded

## 6. Backlog / future branches (expand later)

- Glossary & service-inventory generated views (partially seeded now).
- Schema upload (JSON Schema / Avro / SQL DDL) → `weave:DataAsset` mapping.
- Live connectors: Databricks Unity Catalog, Snowflake information_schema.
- Reasoning (OWL RL) and SHACL validation.
- Multi-user auth, tenancy, graph versioning / branching.
- Collaborative editing, comments threads, review workflow for LLM changes.

## 7. Open questions for round 2 (after first visual inspection)

- Auth/tenancy model (single-tenant MVP vs. orgs from day one)?
- AWS target compute (ECS Fargate vs. App Runner vs. Lambda)?
- Should LLM changes require explicit human approval before commit?
- Layout persistence: store node x/y in the graph (`weave:x/y`) or client-only?
