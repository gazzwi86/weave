---
type: EngineSpec
title: "Weave — Graph Explorer"
description: "The visual canvas onto the company graph: force-directed network, drill-in focus, validated visual editing, async collaboration, and the embeddable GE-CANVAS-1 component. M1 = read-only legibility; M2 = editing + overlays; post-v1 = C4 mode + realtime collab."
tags: [graph-explorer, consolidated]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/weave/engines/graph-explorer.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# Graph Explorer

> The Weave Graph Explorer is the visual canvas onto the company graph — business and technical users
> see their operating model as a navigable, force-directed network, drill into any part of it, and
> (from M2) shape it through validated visual edits. **M1 = read-only legibility** (force canvas +
> drill-in, CE-READ-1). **M2 = editing + overlays + async share.** **post-v1 = C4 mode + realtime
> collaboration (Yjs).** The Constitution Engine owns the model; the Explorer owns how it is seen
> and worked on. [weave-spec](../weave-spec.md) §1.2 · [contracts](../contracts.md) · [constitution-engine](constitution-engine.md) · [build-engine](build-engine.md)

## 1. Brief

### Mission Statement

We are building the Graph Explorer so that every role — operations staff, architects, compliance,
leadership — can see their company operating model as a navigable, force-directed network and
understand the full business at a glance, without reading RDF or writing SPARQL. In M1 this is
**read-only legibility**: see the whole-company graph, spotlight nodes, drill into domains. From M2
it gains visual editing (validated via CE-WRITE-1), overlays, async sharing, and saved views. C4
mode and real-time multi-user collaboration are post-v1, sequenced after the model→generate loop
closes.

### Problem

- **Formal models are unreadable to humans.** RDF/OWL is precise but opaque; only ontologists can
  read it, so the people who hold operating knowledge cannot see the model that describes their work.
- **Generic graph tools are static and solitary.** Existing tools render fixed pictures one person
  edits at a time; they do not let a whole organisation explore a large, living graph and work on it.
- **The whole is invisible.** People understand their own silo but cannot see how domains, systems,
  processes, and data interconnect; cross-cutting impact stays hidden.
- **No shared modelling canvas.** Modelling is inherently a group activity — ops, architecture,
  compliance, leadership all hold pieces — but there is no shared canvas where they build a common
  model. (Real-time co-editing is post-v1; the MVP closes the async-collaboration gap first.)

Without a visual surface the Constitution Engine's model stays locked behind expert tooling: the
graph exists, but the organisation cannot see itself in it, so adoption stalls.

### Scope

#### M1 — READ-ONLY Legibility

- Whole-company force-directed canvas reading the **draft** graph via **CE-READ-1**; node colour by
  BPMO kind; grey fallback for client-extension kinds.
- Pan/zoom/fit; mini-map; semantic zoom (label thresholds).
- Spotlight (node click → neighbourhood + side panel, no raw IRI for business users).
- Cmd+K / sidebar search on `rdfs:label` / `skos:prefLabel` / type label.
- Server-side layout persistence per (tenant, project, graphId) — **FR-008; Aurora schema design is
  an explicit M1 task risk** (see §2.7 risks). "Reset layout" clears and re-runs.
- Drill-in / domain focus: right-click domain → focus; expand/collapse neighbours.
- Impact/dependency trace via CE SPARQL property-path SELECT (CE-READ-1); predicate closure
  confirmed against shipped BPMO relationship types via **OQ-09** — **not hard-coded here**.
- **SPIKE task (M1, Architect):** benchmark Cytoscape + fcose at 10k nodes against the OQ-01
  harness. Go/no-go on WebGL escape hatch (sigma.js/G6) at SPIKE sign-off. Do NOT assert 10k
  performance as settled until the benchmark passes.

#### M2 — Visual Editing & Collaboration

- Filters & Layers (E3): entity-type toggles, relationship-type toggles, client-side property
  filter, governed-content layers.
- Visual Overlays (E4): heatmap (prototype colour mappings), diff overlay (CE-DIFF-1 incl. edge
  mods), pinned impact, domain colouring.
- Visual Editing (E5): add/edit/delete node and draw edge on canvas, all via **CE-WRITE-1** with
  SHACL validation and optimistic rollback. Draft graph only; published versions read-only.
- Async Share & Comments (E6): "share view" via PLAT-NOTIFY-1; comments on nodes/views server-side;
  live-refresh poll fallback over CE-READ-1. (CE-EVENT-1 live-stream upgrade activates when CE ships
  it.)
- Saved Views (E7): save filters/overlays/domain/viewport/layout; workspace-shared library;
  admin-pinned featured views.
- Version Views & Diff (E8): load a published version read-only (CE-VERSION-1/CE-READ-1); diff two
  versions overlay (CE-DIFF-1).
- **Model-Completeness Map (E10, new):** overlay showing which entities lack required links,
  consuming the CE-READ-1 `coverage_gap` query pattern. Authors see what is missing; cold-start
  ramp. ([constitution-engine](constitution-engine.md) CE-READ-1 · [contracts](../contracts.md) §coverage_gap · D6/D7)
- **GE-CANVAS-1 force mode** (E9): embeddable canvas component (force mode), props
  `{source, filterByIri, mode:"force", readonly, version}`, provided to Build Engine.

#### post-v1

- **C4 structured view** (GE-CANVAS-1 c4 mode) — out of M1 and M2. Build M1 does not need it
  ([weave-spec](../weave-spec.md) §1.2); GE-CANVAS-1 force mode unblocks Build. C4 is net-new (no productionised
  prototype); budget distinctly when Build M2/v1.0 requests it. **SS-GE-2 resolved: no Explorer
  deliverable in M1 depends on GE-CANVAS-1 c4.**
- **Real-time multi-user collaboration** (Yjs CRDT) — presence, cursors, concurrent drags,
  follow-me. Deferred: costliest capability, identity/hosting-dependent; sequenced after M2 delivers
  async value.
- **CE-EVENT-1 live-stream upgrade** of live-refresh.

#### Out of Scope

- Model, store, SHACL validation, OWL reasoning — Constitution Engine owns these.
- Versioning lifecycle (draft → published, PROV-O) — CE; Explorer visualises.
- Raw SPARQL query authoring — CE Query screen.
- Automation flow canvas — Events & Actions Engine.
- Project kanban / PM graph views — Build Engine (Build embeds GE-CANVAS-1 slice).

### Target Users

| User | Primary need | Permission level |
|---|---|---|
| Operations / business staff | Visual navigable view, no RDF/SPARQL | viewer (read-only) |
| Enterprise architect | Drill-in, impact/dependency, validated visual editing | BA / ontologist |
| Workshop facilitator | Team-shared views, async share + comments | BA + admin (view-pin) |
| Leadership / exec sponsor | Whole-company view at a glance | viewer |
| Compliance / analyst | Dependency tracing, version views, diff overlay | viewer |

### Success Criteria

- [ ] **M1:** Whole-company draft graph renders and is navigable at realistic scale; OQ-01 benchmark
  passes (or WebGL escape hatch is activated); non-expert viewer completes a find-and-understand task
  without seeing a raw IRI. Target: M1 GA.
- [ ] **M1:** Server-side layout persistence works: drag, reload, layout restored. Target: M1 GA.
- [ ] **M2:** Async collaboration works: save team view (with server-side layout), share, colleague
  opens with same layout and comments. Target: M2 GA.
- [ ] **M2:** Visual edits always validated: 100% of canvas commits go through CE-WRITE-1 SHACL;
  invalid edit is demonstrably blocked. Target: M2 GA.
- [ ] **M2:** Versioned views: user views a specific published version and a diff between two.
  Target: M2 GA.
- [ ] **post-v1:** Real-time collab: ≥ 2 users (target default 5 concurrent) with cursors and
  convergent edits, ≤ 500 ms p95. Target: post-v1 GA.
- [ ] **Cross-tenant isolation:** Tenant-A JWT returns zero tenant-B rows/triples across all reads.

### Constraints

- Explorer is a module within the single modular React SPA (Next.js 15, TypeScript strict) — not a
  separate app.
- Force-directed rendering performance at 10k nodes is **an unverified target** (OQ-01); Cytoscape
  benchmark SPIKE is an **M1 task**; WebGL escape hatch (sigma.js/G6) requires owner + go/no-go at
  SPIKE sign-off.
- All authoritative writes go through CE-WRITE-1 SHACL validation; canvas handle-hiding is UX only,
  never the security boundary. Role vocabulary: **ontologist** (structure), **BA** (instances),
  **viewer** (read-only) per CE-WRITE-1.
- Saved views, layout, and comments are Explorer-owned Aurora tables (tenant + workspace scoped);
  not inter-engine contracts.
- Real-time collab (post-v1) uses Yjs; sync transport finalised at post-v1 tech spec; sync rooms
  must be tenant-scoped.

<!-- Explorer secondary sidebar panels: Explore (canvas) · Saved views · Filters & layers ·
  Versions & diff · Share & comments. Canvas stays visible; panels overlay or filter. -->

## 2. Product Requirements (PRD)

### Product Context

The Constitution Engine holds a formal OWL/SHACL knowledge graph. Without a visual surface that
graph stays expert-only and company-wide adoption stalls. The Explorer is the visual layer: an
interactive force-directed canvas where users explore, filter, overlay, and — from M2 — edit the
operating model, without RDF or SPARQL.

The Explorer does **not** own the model. Every authoritative change goes through CE-WRITE-1
(SHACL-validates on a throwaway clone, commits only on no `sh:Violation`s, writes PROV-O). The
Explorer owns *how the graph is seen and worked on*; the CE owns *what the graph is and whether it
is valid*.

Prototype-proven patterns: Cytoscape.js + fcose for force mode; spotlight, semantic zoom, drag
persistence, edgehandles, heatmap colour mappings. Exact params at tech spec (see
`prototype-findings.md`). Viewport culling and lazy loading are **net-new** (no prototype) — the
architect must design and benchmark them (OQ-01/OQ-04).

**Goals**

1. Make the full company operating model visible and navigable to every role via CE-READ-1 (M1).
2. Provide drill-in focus: domain focus, neighbourhood expand/collapse, impact traversal (M1).
3. Provide rich filtering and overlays (entity type, relationship type, heatmap, diff, impact,
   domain colouring) so users focus on what matters (M2).
4. Allow visual edits (add/edit/delete node, draw edge) on the **draft** graph, validated via
   CE-WRITE-1; published versions read-only (M2).
5. Team-shared, server-persisted Saved Views and layout (D2), async sharing + comments (M2).
   Live collab and CE-EVENT-1 live-stream post-v1.
6. Authors see model completeness: which entities lack required links, via CE-READ-1
   `coverage_gap` query (M2, E10).
7. Visualise CE versioning: load any published version read-only; server-computed diff via
   CE-DIFF-1 (M2).
8. Expose embeddable GE-CANVAS-1 (force mode M2; c4 mode post-v1) for Build Engine.

**Non-Goals**

- Model, store, ontology, SHACL validation, OWL reasoning — CE.
- Versioning lifecycle (draft → published, PROV-O) — CE; Explorer visualises.
- Raw SPARQL query authoring — CE Query screen.
- Automation flow canvas — Events & Actions Engine.
- Project kanban / PM graph views — Build Engine.
- **Real-time multi-user co-editing, presence, cursors, follow-me — post-v1** (D1).
- **GE-CANVAS-1 c4 mode — post-v1** (D4); SS-GE-2 resolved.

**Personas & Roles**

| Persona | Primary need | Permission level |
|---|---|---|
| Operations / business staff | Visual navigable view, no RDF/SPARQL | viewer |
| Enterprise architect | Drill-in, impact/dependency, validated visual editing | BA / ontologist |
| Workshop facilitator | Saved Views, async share + comments (MVP); live collab (post-v1) | BA + admin (view-pin) |
| Leadership / exec sponsor | Whole-company view at a glance, drill-in | viewer |
| Compliance / analyst | Dependency tracing, version views, diff overlay | viewer |

> Role slugs follow CE-WRITE-1 vocab: **ontologist** = structure writes; **BA** = instance writes;
> **viewer** = read-only. **admin** = Platform RBAC (PLAT-SETTINGS-1) for Saved-View governance.

### 2.1 Functional requirements

> M1 = Thin Proof (read-only legibility). M2 = Fast-Follow (editing + overlays + async share).
> post-v1 = C4 + realtime collab. Every FR has a story-level Given/When/Then AC in §3 (Epics).

| ID | Requirement (observable behaviour + failure mode) | Story | Priority | Milestone |
|---|---|---|---|---|
| FR-001 | Force canvas renders draft graph via CE-READ-1 with fcose; CE error → retry empty-state, no partial render | E1-S1 | P0 | M1 |
| FR-002 | Node colour by BPMO kind (CE-served palette + grey fallback); single ellipse shape v1; kind→shape deferred (OQ-08) | E1-S1 | P0 | M1 |
| FR-003 | Canvas load default ≤ 3 s at 1k / ≤ 8 s at 10k nodes (p95) — **unverified; OQ-01 SPIKE gates this** | E1-S1 | P0 | M1 SPIKE gate |
| FR-004 | Pan/zoom: scroll/pinch, Cmd+0 fit; mini-map bottom-right; key bindings `preventDefault` on canvas focus only | E1-S2 | P0 | M1 |
| FR-005 | Semantic zoom: edge labels hide below threshold (default 0.55×, tunable); node labels above threshold (default 0.3×, tunable) | E1-S2 | P0 | M1 |
| FR-006 | Node click → spotlight (neighbourhood full, rest default 0.18 opacity tunable); side panel shows label/type/key props; **no raw IRI** for business users | E1-S3 | P0 | M1 |
| FR-007 | Cmd+K / sidebar search on `rdfs:label`, `skos:prefLabel`, type label; click result → centre + spotlight; no global key capture | E1-S4 | P0 | M1 |
| FR-008 | Layout positions persisted **server-side** per (tenant, project, graphId); applied before fcose; "Reset layout" clears + re-runs; failed save → optimistic hold + retry | E1-S5 | P0 | M1 |
| FR-009 | Right-click domain → "Focus domain" filters to members; empty domain → empty-state | E2-S1 | P0 | M1 |
| FR-033 | Expand/collapse neighbours; expansion > default 500 (tunable) → confirm | E2-S2 | P1 | M1 |
| FR-010 | Impact/dependency trace via CE SPARQL property-path SELECT (CE-READ-1); **predicate closure confirmed via OQ-09** (do not hard-code predicates here); depth default-all/cap N (default 6, tunable); off-canvas nodes auto-load or badge; never silently truncate | E2-S3 | P0 | M1 (predicate closure gated on OQ-09) |
| FR-011 | Entity-type toggles; off hides nodes + edges, layout re-flows; all-off → empty-state | E3-S1 | P0 | M2 |
| FR-012 | Relationship-type toggles (multi); orphaned nodes de-emphasised not removed | E3-S2 | P0 | M2 |
| FR-013 | Property filter builder (type+path+operator+value, AND, chips) — **client-side over loaded nodes only**; missing path → non-match | E3-S3 | P1 | M2 |
| FR-014 | Governed-content layer toggles (Glossary/Brand/Governance); empty layer → toggle disabled | E3-S4 | P1 | M2 |
| FR-015 | Heatmap overlay with **prototype value→colour mappings** (maturity/investment/strategy/lifecycle, free-text fields); unmatched → grey + legend count | E4-S1 | P0 | M2 |
| FR-016 | Diff overlay via CE-DIFF-1 between two published versions; added/removed/modified incl. **edge modifications** (D3); identical → "no differences"; CE error → retry banner | E4-S2 | P0 | M2 |
| FR-017 | Pinned impact overlay persists through pan/zoom; source-delete auto-clears | E4-S3 | P0 | M2 |
| FR-018 | Domain colouring layer (mutually exclusive with type colouring v1); palette overflow cycles with legend | E4-S4 | P1 | M2 |
| FR-019 | Double-click → quick-add node via CE-WRITE-1; `422` shows SHACL violations; CE timeout → optimistic rollback | E5-S1 | P0 | M2 |
| FR-020 | Edgehandles drag-connect (prototype params, tunable); edge op via CE-WRITE-1; self-loop blocked; timeout → rollback | E5-S2 | P0 | M2 |
| FR-021 | Side-panel edit of label/comment/typed props via CE-WRITE-1 (`update_node`); PROV-O + PLAT-AUDIT-1 stamp; concurrent same-prop = LWW-with-version-check, else `409` notify | E5-S3 | P0 | M2 |
| FR-022 | Delete node/edge via CE-WRITE-1: reference warning + confirm; cascaded reification cleanup reflected from CE response; failure → nothing removed | E5-S4 | P0 | M2 |
| FR-023 | Async share of a Saved View → recipient notified via PLAT-NOTIFY-1; recipients lacking access excluded (no leak) | E6-S1 | P0 | M2 |
| FR-024 | Comments on node/view persisted server-side (Explorer Aurora, tenant+workspace scoped); failed write → draft preserved + retry | E6-S2 | P0 | M2 |
| FR-025 | Live refresh: poll CE-READ-1 (since-version, default 30 s tunable); upgrade to CE-EVENT-1 stream when CE ships it | E6-S3 | P1 | M2 (poll) / post-v1 (live stream) |
| FR-026 | Realtime co-edit + presence/cursors (Yjs, default 5 concurrent / ≤500 ms p95, tunable); CRDT room id includes tenant id, JWT tenant validated at connect | E6-S4 | Won't-M2/Must-pv1 | post-v1 |
| FR-027 | Workshop "Follow me" (viewport-only sync) | E6-S5 | Won't-M2/Should-pv1 | post-v1 |
| FR-028 | Save view (filters, overlays, domain focus, viewport, **server-side layout**); name required; collision → overwrite/rename prompt | E7-S1 | P0 | M2 |
| FR-029 | Workspace-shared view library; creator deletes own, workspace admin (PLAT-SETTINGS-1) deletes any; missing entities flagged | E7-S2 | P0 | M2 |
| FR-030 | Featured pinned views (default 5 tunable, admin-pinned); limit → unpin prompt | E7-S3 | P1 | M2 |
| FR-031 | Versions panel lists versions via CE-VERSION-1; select loads via CE-READ-1 read-only; default canvas = **draft**; `latest` = newest published | E8-S1 | P0 | M2 |
| FR-032 | Version compare applies CE-DIFF-1 diff overlay; JSON summary export (PDF/CSV → OQ-06) | E8-S2 | P0 | M2 |
| FR-035 | Model-completeness map: CE-READ-1 `coverage_gap(process)` → `{entity_iri, missing_link}` overlaid on canvas; gap-flagged nodes get indicator; click → spotlight + missing-link list in side panel | E10-S1 | P0 | M2 |
| FR-036 | Completeness drill: from gap side panel, shortcut to CE editing surface or (if E5 available) visual-edit inline | E10-S2 | P1 | M2 |
| FR-034 | GE-CANVAS-1 embeddable component (force mode), props `{source, filterByIri, mode:"force", readonly, version}`; provided to Build Engine | E9-S1 | P0 | M2/v1.0 |
| FR-034c | GE-CANVAS-1 c4 mode (`mode:"c4"`) — structured architecture view | E9-S2 | post-v1 only | post-v1 |

### 2.2 Non-functional requirements

**Performance**

- Canvas initial load: default ≤ 3 s at 1k nodes, ≤ 8 s at 10k nodes (p95, desktop Chrome/Safari).
  **Unverified pending OQ-01 benchmark SPIKE (M1 task, Architect owner) — not a settled capability.**
  Go/no-go on WebGL escape hatch (sigma.js/G6) at SPIKE sign-off. All values tunable.
- Node drag: default ≤ 16 ms (60 fps) at ≤ 1,000 visible nodes; tunable.
- Filter/overlay apply: default ≤ 300 ms at up to 10k nodes; tunable.
- post-v1 cursor sync: default ≤ 500 ms p95 at default 5 concurrent users; tunable.

**Scalability**

- v1 target: up to default 10,000 nodes / 30,000 edges (tunable) with Cytoscape + fcose.
  Viewport culling and lazy loading are **net-new (no prototype implementation)**, designed and
  benchmarked by the architect (OQ-01/OQ-04). WebGL renderer (sigma.js/G6) is the escape hatch
  if Cytoscape cannot meet targets (OQ-05); **owner: Architect; go/no-go at M1 SPIKE sign-off.**

**Security**

- All CE calls require a Cognito JWT. **Authoritative edit-authorisation boundary is CE-WRITE-1
  server-side (JWT + CE role claim)** — canvas handle-hiding is UX only, never the security control.
- Published-version views are always read-only.
- Secrets in AWS Secrets Manager only — never in `.env` or source.
- post-v1: CRDT sync-room id includes tenant id; server validates JWT tenant claim on connect.
- Explorer Aurora writes use parameterised queries; no string concatenation into SQL.

**Reliability**

- Edit flows are optimistic with rollback on CE-WRITE-1 error/timeout (default 10 s, tunable):
  add/edge/delete never leave an orphan or phantom-removed element.
- Live refresh degrades from CE-EVENT-1 (post-v1) to polling CE-READ-1 (default 30 s) without
  blocking the user.
- Layout/view/comment writes retry with backoff; never silently dropped.

**Observability**

OTel spans: graph load (`ce.read` attrs `version`, `node_count`), edit commit (`ce.write` attrs
`op_type`, `result`, `actor_principal`), diff (`ce.diff` attrs `from`, `to`), traversal
(`ce.sparql.path` attrs `depth`, `hops`). Errors correlate by request id; PLAT-AUDIT-1 `seq` of
each committed edit logged for cross-reference.

**Accessibility**

Side panel, search overlay, filter sidebar, comments: **WCAG 2.1 AA**, keyboard-navigable,
ARIA-labelled. Canvas interactions have keyboard equivalents; force canvas need not be fully
SR-navigable in v1 but must not trap keyboard focus. Gate: **zero axe-core violations** on
non-canvas UI in CI.

**Isolation & data safety**

All CE reads/writes are tenant-scoped via CE's named-graph + query-rewriting that rejects any
unscoped query. Explorer-owned Aurora tables carry `tenant_id` + `workspace_id` on every row.

**Required test:** Given a tenant-A JWT, when any Explorer read is issued (graph load, Saved View
list, comment fetch, diff), then **zero tenant-B rows/triples** are returned; any attempt to address
a tenant-B view id or room (post-v1) is rejected.

**Browser:** Chrome, Firefox, Safari — latest 2 major versions. Desktop-first; no mobile in v1.

### 2.3 Inter-engine interfaces

> Contracts by ID from [contracts](../contracts.md) (`../contracts.md`). Consumed contracts version-pinned (B2/CE-VERSION-1).

**Consumed (Explorer calls / reads)**

| Provider | Contract | Used for | Milestone |
|---|---|---|---|
| Constitution Engine | CE-READ-1 (`/api/ontology/types|resource|versions`, `/api/sparql` SELECT/paginated, `/api/node-kinds`) | Graph load, palette, spotlight props, impact traversal, version load, `coverage_gap` query | M1 |
| Constitution Engine | CE-WRITE-1 (`POST /api/operations/apply`) | All node/edge add/update/delete; authz boundary; Build canvas write-back | M2 |
| Constitution Engine | CE-DIFF-1 (`/api/ontology/diff?from&to`) | Diff overlay incl. edge mods | M2 |
| Constitution Engine | CE-VERSION-1 (`/api/ontology/versions`) | Version list + lag for Versions panel | M2 |
| Constitution Engine | CE-EVENT-1 (graph-change stream) | Live in-place refresh upgrade (post-v1 only; M2 ships poll fallback) | post-v1 |
| Platform | PLAT-NOTIFY-1 | Share notifications | M2 |
| Platform | PLAT-SETTINGS-1 | Workspace-admin RBAC; tenant scope of views/comments/layout | M1 |
| Platform | PLAT-IDENTITY-1 | Actor principal IRI for agent-initiated writes only | M2 |
| Platform | PLAT-AUDIT-1 | Read-only: correlate edit audit `seq` | M2 |

**Provided (Explorer exposes to others)**

| Contract | Consumers | Mode | Milestone |
|---|---|---|---|
| GE-CANVAS-1 — embeddable canvas, props `{source, filterByIri, mode, readonly, version}` | Build Engine | `force` | M2/v1.0 |
| GE-CANVAS-1 — `mode:"c4"` — structured architecture view | Build Engine (post-v1 only) | `c4` | post-v1 |

> Saved Views, layout, and comments are Explorer-internal (Aurora tables). Not inter-engine contracts.

### 2.4 Open questions

| # | Question | Owner |
|---|---|---|
| OQ-01 | Cytoscape + fcose at 10k nodes: can it meet ≤ 8 s load / 60 fps drag targets? **M1 SPIKE; defines go/no-go on WebGL escape hatch (OQ-05).** | Architect |
| OQ-02 | post-v1: Yjs sync transport + scaling: single Fargate vs distributed (y-redis); concurrent-session ceiling. | Architect |
| OQ-03 | Whole-version graph retrieval at scale: dedicated CE bulk/CONSTRUCT endpoint vs paginated CE-READ-1 SELECT. Cross-engine dependency on CE. | CE + Architect |
| OQ-04 | Viewport culling + lazy-loading design + benchmark (net-new). Tied to OQ-01. | Architect |
| OQ-05 | WebGL escape hatch if 10k target unmet (sigma.js / G6). **Go/no-go at M1 SPIKE sign-off; Architect owns decision.** | Architect |
| OQ-06 | Diff/version export format beyond JSON (PDF/CSV); whether export is a CE-owned report endpoint. | Architect + Compliance |
| OQ-07 | post-v1: "Follow me" transport: shared Yjs vs separate broadcast channel. | Architect |
| OQ-08 | Kind→shape and relationship-type→stroke visual mapping (net-new design; beyond colour-only prototype). | PO + Design |
| OQ-09 | **Exact closure of impact traversal predicates** across shipped BPMO relationship types. **Resolve against CE data-model before building E2-S3.** Must not be pre-judged here. | Architect + CE |
| OQ-10 | ODRL policy enforcement not in v1; PII/sensitive uses SHACL + data-classification properties. Whether any overlay must surface data-classification deferred. | Architect |
| OQ-11 | Whether human-initiated CE-WRITE-1 edits should be attributed to a PLAT-IDENTITY-1 principal IRI (vs raw Cognito identity) in PROV-O / audit. | Architect + Platform |

### 2.5 Key design decisions

> Platform-wide decisions at [weave-spec](../weave-spec.md) §Program. Explorer-specific decisions:

| Decision | Rationale | Date |
|---|---|---|
| Explorer owns visual canvas (incl. GE-CANVAS-1 force mode M2; c4 post-v1); CE owns model + validation | Clean separation: how graph is seen and worked on vs what it is and what is valid | 2026-06-26 |
| **M1 = read-only legibility** (force canvas + drill-in only; no editing, no saved views) | Build M1 needs only CE-READ-1 to demonstrate model→visualise; editing and overlays add risk with no M1 value | 2026-06-30 |
| **GE-CANVAS-1 c4 mode = post-v1** (SS-GE-2 resolved; D4) | Build M1 does not need c4 ([weave-spec](../weave-spec.md) §1.2); c4 is net-new and costlier than force; budget separately when Build requests it | 2026-06-30 |
| Real-time collab = post-v1; M2 = async share + comments (D1) | Costliest capability; identity/hosting-dependent; async delivers the shared-lens value without it | 2026-06-30 |
| post-v1 realtime collab uses Yjs CRDT | Mature, portable, self-hostable on AWS; no per-seat SaaS lock-in | 2026-06-26 |
| All authoritative writes via CE-WRITE-1 SHACL; authz boundary is server-side | Visual editing must never produce an invalid model; canvas handle-hiding is UX, not security | 2026-06-30 |
| **Impact traversal predicates NOT hard-coded here — resolved at CE data-model via OQ-09** (SS-GE-4) | Predicate directions depend on shipped BPMO relationship types; pre-judging causes cross-spec seam | 2026-06-30 |
| **Cytoscape 10k SPIKE = M1 gate; WebGL escape hatch has Architect owner + go/no-go point** (SS-GE-1) | 10k at 60 fps is unverified; benchmarking before downstream engines rely on Explorer is the safe sequence | 2026-06-30 |
| Server-side layout + views + comments (D2): Explorer-owned Aurora | Team-shared named views need server persistence; per-browser localStorage cannot be shared | 2026-06-30 |
| **FR-008 Aurora layout-schema design = M1 task risk** | Schema is net-new (no prototype server-side layout); wrong schema blocks E1-S5 and all Saved Views | 2026-06-30 |
| Explorer visualises versioning and server-computed diff (CE-DIFF-1) incl. edge mods (D3) | Users see what changed between published versions incl. relationship changes | 2026-06-30 |
| Default edit target = draft graph; published versions read-only; `latest` = newest published | Cannot edit an immutable published version | 2026-06-26 |
| Heatmap uses prototype value→colour mappings; EA fields are free-text strings | Removes unfalsifiable "auto-derived" scheme; matches the CE data model | 2026-06-30 |
| Property filter builder = client-side visual filtering only, not a CE query | CE Query screen is the sole query-authoring surface | 2026-06-26 |
| Raw IRI hidden from business-user side panel (advanced disclosure for ontologists) | Upholds the model-hiding contract that is the product's reason to exist | 2026-06-26 |

### 2.6 PRD-level acceptance criteria

The Graph Explorer PRD is satisfied when:

- [ ] **M1:** A non-technical viewer opens the Explorer and spotlights a named entity without writing
  SPARQL or seeing a raw IRI.
- [ ] **M1:** Node positions saved server-side, restored on reload, reset on "Reset layout".
- [ ] **M1:** OQ-01 SPIKE report confirms Cytoscape can meet (or cannot meet, triggering OQ-05
  WebGL escape hatch) the 10k-node targets.
- [ ] **M2:** A BA-role user creates a node; an invalid creation returns `422` from CE-WRITE-1 as
  human-readable SHACL violation; a timeout rolls back the optimistic node with no orphan.
- [ ] **M2:** Diff overlay shows correct added/removed/**modified (incl. edges)** between two
  published versions via CE-DIFF-1.
- [ ] **M2:** Saved View with filters + overlays + server-side layout is saved, shared via
  PLAT-NOTIFY-1, and reproduced for a different workspace user.
- [ ] **M2:** Compliance analyst views graph in a specific historical published version, read-only.
- [ ] **M2:** Model-completeness map correctly overlays gap indicators from `coverage_gap` query.
- [ ] **M2:** Build Engine mounts GE-CANVAS-1 (`force` mode only at M2) and writes a project-arch
  change back via CE-WRITE-1.
- [ ] Cross-tenant isolation test passes: tenant-A JWT returns zero tenant-B rows/triples.

### 2.7 Risks & mitigations

| Risk | Impact | Likelihood | Mitigation | Milestone |
|---|---|---|---|---|
| **Cytoscape cannot hit 10k-node targets (SS-GE-1)** | High | Med | M1 benchmark SPIKE (OQ-01, Architect owner); WebGL escape hatch (sigma.js/G6, OQ-05) must have **owner + go/no-go point at SPIKE sign-off** | M1 |
| **FR-008 Aurora layout-schema design is net-new (SS-GE-3)** | Med | High | Name schema design as an **explicit M1 task** (Architect + BE); E1-S5 is blocked until schema is approved; covered by isolation test | M1 |
| Impact traversal predicate semantics wrong (SS-GE-4, OQ-09) | Med | Med | Predicate closure NOT hard-coded in ACs; confirmed against shipped BPMO types before E2-S3 build | M1 SPIKE → M1 |
| CE-WRITE-1 / CE-DIFF-1 shapes shift during CE tech spec | Med | Med | Consume by contract ID; pin versions; integration tests against CE stubs | M2 |
| post-v1 realtime collab underestimated (E6-S4/S5) | High | Med | D1 defers out of M2; cost warning surfaced; budget at post-v1 tech spec | post-v1 |
| Viewport culling + lazy loading (OQ-04) not in prototype | Med | Med | Architect designs before M1 SPIKE; gate on OQ-01 harness results | M1 |

## 3. Epics

> Story ACs use Given/When/Then; epic exit criteria use EARS.
> **[contracts](../contracts.md)** = `../contracts.md` · **[constitution-engine](constitution-engine.md)** = `../engines/constitution-engine.md`
> · **[build-engine](build-engine.md)** = `../engines/build-engine.md`

---

### M1 — Thin Proof (read-only legibility)

*E1 + E2 ship in M1. M1 Explorer exit gate: force canvas renders, is navigable, OQ-01 SPIKE
done. No editing, no saved views, no overlays at M1.*

---

### EPIC-001 — Whole-Company Canvas (force mode) · M1

**Milestone:** M1 · **Priority:** Must Have · **Consumes:** CE-READ-1, PLAT-SETTINGS-1 ·
**Blocks:** EPIC-002, and all M2 epics

Force-directed canvas: draft graph loads via CE-READ-1, nodes coloured by BPMO kind, users pan,
zoom, spotlight, and search without RDF. Server-side layout persists across sessions. Also
includes the M1 benchmark SPIKE task for OQ-01.

**User stories**

| Task | Title | Priority |
|---|---|---|
| E1-S0 | **SPIKE: OQ-01 Cytoscape benchmark** | Must Have (M1 gate) |
| E1-S1 | View the whole company graph on load | Must Have |
| E1-S2 | Pan, zoom, navigate | Must Have |
| E1-S3 | Spotlight a node | Must Have |
| E1-S4 | Search for a node by name or type | Must Have |
| E1-S5 | Persist and reset layout (server-side, D2) | Must Have |

**E1-S0: SPIKE — OQ-01 Cytoscape 10k-node benchmark** *(M1 task risk)*

Run the OQ-01 benchmark harness (browser, hardware, node/edge count, fps sampling defined in
harness spec) against Cytoscape + fcose at 1k / 5k / 10k nodes. Deliver a benchmark report.

- **AC (go):** Given the harness result, when Cytoscape meets ≤ 8 s load / 60 fps drag at 10k
  nodes, then the SPIKE passes and E1-S1 performance criterion stands.
- **AC (no-go):** Given the harness result, when Cytoscape does not meet targets, then the
  Architect raises OQ-05 decision (WebGL escape hatch — sigma.js/G6); build of E1-S1 is paused
  until the renderer decision is made.
- **Owner:** Architect. **Blocks:** E1-S1 performance AC, all 10k NFRs.
- **ALSO (layout schema):** Design and approve the Explorer-owned Aurora layout-schema
  (tenant_id, workspace_id, graph_id, node_iri, position_x, position_y, locked). Blocks E1-S5.

**E1-S1: View the whole company graph on load**

- **AC:** Given an authenticated user, when the Explorer opens, then nodes and edges of the current
  **draft** graph load via CE-READ-1 and render in the Cytoscape/fcose force canvas (fcose params at
  tech spec; randomize/auto-layout runs only for nodes lacking saved positions).
- **AC:** Given the loaded graph, when rendered, then each node is coloured by its CE BPMO kind
  (palette served by CE `/api/node-kinds` via CE-READ-1; client palette fallback only). Palette
  covers every BPMO kind with grey fallback for unrecognised/extension kinds. `Process` takes a
  prominent hue. Node shape = single ellipse in v1 (kind→shape deferred, OQ-08).
- **AC (failure):** Given CE-READ-1 returns an error or times out (default 10 s, tunable), when
  the canvas tries to load, then an empty-state with retry and the CE error message is shown;
  no partial render.
- **AC (performance — gated on E1-S0 SPIKE):** Given the OQ-01 reference hardware, when the
  Explorer loads, then first interactive render completes within default ≤ 3 s at 1k / ≤ 8 s at
  10k nodes (p95), tunable — verified by the OQ-01 benchmark harness.

**E1-S2: Pan, zoom, navigate**

- **AC:** Given the canvas, when the user scrolls/pinches, then it zooms; Cmd/Ctrl+0 → fit-to-screen.
- **AC:** Given semantic zoom thresholds (default 0.55× edge-label, 0.3× node-label, tunable), when
  zoom crosses a threshold, then labels hide/show accordingly (edge labels on hover when visible).
- **AC:** Given the canvas, when rendered, then a mini-map (bottom-right) shows viewport position.
- **AC (failure):** Given Cmd+0 / Cmd+K binding collision, when canvas lacks focus, then the canvas
  handler does not fire (no global capture).

**E1-S3: Spotlight a node**

- **AC:** Given a node click, then `closedNeighborhood` stays at full opacity; all other elements dim
  to default 0.18 opacity (tunable).
- **AC:** Given spotlight, when the side panel opens, then it shows label, human-readable type, and
  key property values from CE. **Raw IRI not shown** in the default panel; revealed only under
  "Advanced / technical details" for ontologist-role users.
- **AC (failure):** Given background click or Escape, then spotlight clears; if side-panel property
  fetch fails, panel shows label + type already loaded with "details unavailable" notice.

**E1-S4: Search for a node by name or type**

- **AC:** Given Cmd/Ctrl+K (or sidebar search focus), then a search overlay opens; matching
  nodes highlight on `rdfs:label`, `skos:prefLabel`, and entity-type label; non-matching dim.
- **AC:** Given a search result click, then the canvas centres and spotlights that node.
- **AC (failure):** Given Cmd+K not available (browser focus absent), then binding does not fire;
  sidebar search remains available.

**E1-S5: Persist and reset layout (server-side, D2)**

- **AC:** Given a node drag, when drag ends, then its position is persisted **server-side** scoped
  per (tenant, project, graphId) — not in localStorage. On next Explorer open, saved positions
  are applied before fcose runs.
- **AC:** Given "Reset layout", when clicked, then server-side positions are cleared and fcose
  re-runs from scratch.
- **AC (failure):** Given a failed position save, then the position is held optimistically in memory
  with background retry; position is never silently dropped.
- **Blocked by:** E1-S0 layout-schema sign-off.

**Epic-level acceptance criteria (EARS)**

- [ ] WHEN an authenticated viewer opens the Explorer THE SYSTEM SHALL render the draft graph via
  CE-READ-1 as a Cytoscape/fcose force canvas, coloured by CE BPMO kind, within default ≤ 3 s at
  1k / ≤ 8 s at 10k nodes (p95, tunable) — verified by OQ-01 benchmark report.
- [ ] WHEN a viewer searches and clicks a result THE SYSTEM SHALL centre, spotlight, and show the
  node side panel **without exposing a raw IRI** — verified by E1-S3/E1-S4 E2E test.
- [ ] WHEN a node is dragged THE SYSTEM SHALL persist the position server-side and restore it on
  next load — verified by E1-S5 integration test.
- [ ] WHEN CE-READ-1 returns an error THE SYSTEM SHALL show an empty-state with retry; no partial
  render — verified by E1-S1 failure test.
- [ ] WHEN any Explorer read is issued under a tenant-A JWT THE SYSTEM SHALL return zero tenant-B
  rows/triples — verified by cross-tenant isolation test.
- [ ] OQ-01 benchmark report delivered and signed off by Architect before E1-S1 performance AC
  is accepted.

---

### EPIC-002 — Drill-In & Domain Focus · M1

**Milestone:** M1 · **Priority:** Must Have · **Consumes:** CE-READ-1 ·
**Blocked by:** EPIC-001

Domain focus, neighbourhood expand/collapse, and impact/dependency traversal. The predicate
closure for impact traversal is confirmed via OQ-09 — **no predicate names are hard-coded in
ACs here** (SS-GE-4 fix).

**User stories**

| Task | Title | Priority |
|---|---|---|
| E2-S1 | Focus a domain | Must Have |
| E2-S2 | Expand / collapse neighbourhood | Should Have |
| E2-S3 | Impact / dependency trace | Must Have |

**E2-S1: Focus a domain**

- **AC:** Given a right-click on a domain node, when "Focus domain" is selected, then the canvas
  filters to that domain's members; the rest of the graph de-emphasises.
- **AC:** Given an empty domain, when focused, then an empty-state is shown.
- **AC (failure):** Given a CE-READ-1 error on domain member fetch, then an error notice is shown;
  the full graph is restored.

**E2-S2: Expand / collapse neighbourhood**

- **AC:** Given a spotlighted node, when the user requests neighbour expansion, then immediate
  neighbours load and attach in the canvas.
- **AC:** Given expansion would add > default 500 nodes (tunable), then a "Load N more nodes —
  continue?" confirm is shown before fetching.
- **AC:** Given expand, then collapse reverses: neighbours retract; focus node remains visible.

**E2-S3: Impact / dependency trace** *(SS-GE-4 fix — no hard-coded predicates)*

- **AC:** Given a spotlighted node, when the user requests impact/dependency traversal, then the
  Explorer sends a SPARQL property-path SELECT to CE-READ-1 using **the predicate closure confirmed
  against the shipped BPMO relationship types (OQ-09 — resolved before E2-S3 is built)**.
  Traverse depth default all / cap N (default 6, tunable).
- **AC:** Given traversal results, then nodes already on canvas are highlighted; off-canvas
  nodes auto-load (up to cap) or are badged as "N more in chain"; never silently truncate.
- **AC:** Given impact overlay enabled, then pinned result persists through pan/zoom; source-node
  delete auto-clears the overlay.
- **AC (failure):** Given CE-READ-1 returns an error, then traversal results are empty with an
  error notice; existing canvas elements are unaffected.
- **Blocked by:** OQ-09 resolved and predicate closure confirmed at CE data-model stage.

**Epic-level acceptance criteria (EARS)**

- [ ] WHEN a viewer right-clicks a domain and selects "Focus domain" THE SYSTEM SHALL filter the
  canvas to that domain's members via CE-READ-1 — verified by E2-S1 test.
- [ ] WHEN a viewer requests impact traversal THE SYSTEM SHALL send a property-path SELECT using
  the OQ-09-confirmed predicate closure; results highlight on-canvas and badge off-canvas nodes;
  depth is capped and tunable — verified by E2-S3 test with a testable example graph.
- [ ] Coverage ≥ 80% (tunable) · mutation ≥ 70% (tunable) · 0 blocking bugs.

---

### M2 — Fast-Follow (editing + overlays + async share)

*E3–E8 + E10 ship in M2. GE-CANVAS-1 force mode (E9) also ships in M2/v1.0.*
*M2 Explorer depends on M1 gate passed.*

---

### EPIC-003 — Filters & Layers · M2

**Milestone:** M2 · **Priority:** Must Have · **Consumes:** CE-READ-1 ·
**Blocked by:** EPIC-001

Entity-type and relationship-type toggles; client-side property filter; governed-content layers.

**User stories**

| Task | Title | Priority |
|---|---|---|
| E3-S1 | Entity-type toggles | Must Have |
| E3-S2 | Relationship-type toggles | Must Have |
| E3-S3 | Property filter builder | Should Have |
| E3-S4 | Governed-content layers | Should Have |

**E3-S1: Entity-type toggles**

- **AC:** Given entity-type toggle panel, when a type is toggled off, then its nodes + incident
  edges hide and layout re-flows; all-off → empty-state.
- **AC (failure):** Given toggle results in empty graph, then empty-state is shown (not blank canvas).

**E3-S2: Relationship-type toggles**

- **AC:** Given relationship-type toggles (multi-select), when a type is toggled off, then its
  edges hide; orphaned nodes de-emphasise (not removed).

**E3-S3: Property filter builder**

- **AC:** Given the filter builder (type + path + operator + value, AND logic, chip display), when
  a filter is applied, then matching nodes remain highlighted; non-matching dim. **Client-side
  over loaded nodes only — not a CE query.**
- **AC:** Given a property path not present on any loaded node, then all nodes non-match (no error).

**E3-S4: Governed-content layers**

- **AC:** Given governed-content layer toggles (Glossary / Brand / Governance), when toggled on,
  then relevant content nodes load and overlay via CE-READ-1.
- **AC:** Given an empty layer (no governed content), then the toggle is disabled with tooltip.

---

### EPIC-004 — Visual Overlays · M2

**Milestone:** M2 · **Priority:** Must Have · **Consumes:** CE-READ-1, CE-DIFF-1 ·
**Blocked by:** EPIC-001

Heatmap, diff overlay, pinned impact, domain colouring.

**User stories**

| Task | Title | Priority |
|---|---|---|
| E4-S1 | Heatmap overlay | Must Have |
| E4-S2 | Version diff overlay | Must Have |
| E4-S3 | Pinned impact overlay | Must Have |
| E4-S4 | Domain colouring layer | Should Have |

**E4-S1: Heatmap overlay**

- **AC:** Given heatmap enabled (maturity / investment / strategy / lifecycle dimensions), when
  applied, then nodes colour by **prototype value→colour mapping**; unmatched values → grey with
  count in legend.
- **AC:** Given mutually exclusive overlays, when heatmap is active then diff overlay is disabled
  (and vice versa).

**E4-S2: Version diff overlay**

- **AC:** Given two published versions selected, when diff is applied, then the Explorer calls
  CE-DIFF-1 and overlays: added (green) / removed (red, default 0.35 opacity, tunable) / modified
  incl. **edge modifications** (amber); identical → "no differences" banner.
- **AC (failure):** Given CE-DIFF-1 error, then a retry banner is shown; existing canvas unchanged.

**E4-S3: Pinned impact overlay**

- **AC:** Given an impact traversal (E2-S3) result is pinned, then the overlay persists through
  pan/zoom/filter changes.
- **AC:** Given the source node is deleted, then the pinned overlay auto-clears.

**E4-S4: Domain colouring layer**

- **AC:** Given domain colouring enabled, then nodes are coloured by their domain membership
  (mutually exclusive with type colouring in v1); palette overflow cycles; legend shows mapping.

---

### EPIC-005 — Visual Editing on the Canvas · M2

**Milestone:** M2 · **Priority:** Must Have · **Consumes:** CE-WRITE-1, PLAT-AUDIT-1 ·
**Blocked by:** EPIC-001, EPIC-002

Add/edit/delete nodes and edges on the draft graph canvas, all committed through CE-WRITE-1 with
optimistic rollback. Published versions are read-only.

**User stories**

| Task | Title | Priority |
|---|---|---|
| E5-S1 | Quick-add node | Must Have |
| E5-S2 | Draw edge | Must Have |
| E5-S3 | Edit node properties | Must Have |
| E5-S4 | Delete node / edge | Must Have |

**E5-S1: Quick-add node**

- **AC:** Given a BA / ontologist user, when double-clicking the canvas, then a new node is
  optimistically rendered and committed via CE-WRITE-1 (`add_node`).
- **AC:** Given CE-WRITE-1 returns `422`, then SHACL violation is shown as human-readable text and
  the optimistic node is removed.
- **AC:** Given CE-WRITE-1 times out (default 10 s, tunable), then the optimistic node is rolled
  back; no orphan on canvas.

**E5-S2: Draw edge**

- **AC:** Given an edgehandles drag (prototype params, tunable; self-loop blocked), when the edge
  is released on a valid target, then the edge is committed via CE-WRITE-1 optimistically.
- **AC:** Given timeout or `422`, then the optimistic edge is rolled back.

**E5-S3: Edit node properties**

- **AC:** Given a BA / ontologist editing a node's label/comment/typed props in the side panel,
  when saved, then CE-WRITE-1 (`update_node`) is called; CE writes PROV-O + PLAT-AUDIT-1 stamp
  (actor = editing user's Cognito identity).
- **AC:** Given concurrent same-property edit by two users, then LWW-with-version-check applies;
  second writer receives `409` and a conflict notice.

**E5-S4: Delete node / edge**

- **AC:** Given a delete action, when confirmed (after reference warning), then CE-WRITE-1 is
  called; cascaded reification/annotation cleanup is reflected on canvas from CE response.
- **AC:** Given CE-WRITE-1 failure, then nothing is removed from canvas.

**Epic-level acceptance criteria (EARS)**

- [ ] WHEN a BA double-clicks to add a node THE SYSTEM SHALL commit via CE-WRITE-1, surface `422`
  as human-readable SHACL violation, and roll back on timeout — verified by E5-S1 integration test.
- [ ] WHEN two users concurrently edit the same property THE SYSTEM SHALL apply LWW and notify the
  second writer via `409` — verified by concurrency test.
- [ ] All write paths carry PROV-O attribution and PLAT-AUDIT-1 stamp — verified by audit log check.

---

### EPIC-006 — Async Share & Comments · M2

**Milestone:** M2 (async share + comments + live-refresh poll) ·
post-v1 (realtime co-edit, follow-me, CE-EVENT-1 live-stream) ·
**Consumes:** PLAT-NOTIFY-1, CE-READ-1 (poll), CE-EVENT-1 (post-v1) ·
**Blocked by:** EPIC-001, EPIC-007

M2 stories ship async collaboration (S1–S3). Post-v1 stories (S4–S5) are stubs here.

**User stories**

| Task | Title | Priority | Milestone |
|---|---|---|---|
| E6-S1 | Share a saved view | Must Have | M2 |
| E6-S2 | Comment on a node or view | Must Have | M2 |
| E6-S3 | Live-refresh (poll fallback) | Should Have | M2 |
| E6-S4 | Realtime co-edit + presence (Yjs) | Won't-M2 / Must-pv1 | post-v1 |
| E6-S5 | Workshop "Follow me" | Won't-M2 / Should-pv1 | post-v1 |

**E6-S1: Share a saved view**

- **AC:** Given a user shares a Saved View, then PLAT-NOTIFY-1 notifies eligible recipients;
  recipients without graph access are excluded (no cross-user data leak).

**E6-S2: Comment on a node or view**

- **AC:** Given a comment is submitted on a node or view, then it is persisted server-side
  (Explorer Aurora, tenant + workspace scoped); failed write → draft preserved + retry.

**E6-S3: Live-refresh (poll fallback)**

- **AC:** Given the Explorer is open, then it polls CE-READ-1 (`since-version`, default 30 s,
  tunable) for graph changes and reconciles in place.
- **AC:** Given CE-EVENT-1 becomes available (post-v1), then the polling fallback is replaced by
  the event stream; the user experience is equivalent.

**E6-S4/S5 (post-v1 stubs):** Yjs CRDT realtime co-edit + presence/cursors; workshop follow-me.
Dependencies: OQ-02/OQ-07 resolved; CE-EVENT-1 shipped; post-v1 tech spec approved.

---

### EPIC-007 — Saved Views & Layout · M2

**Milestone:** M2 · **Priority:** Must Have · **Consumes:** PLAT-SETTINGS-1 ·
**Blocked by:** EPIC-001 (and E1-S0 layout-schema sign-off)

Server-side, team-shared named views (filters, overlays, domain focus, viewport, layout).

**User stories**

| Task | Title | Priority |
|---|---|---|
| E7-S1 | Save a view | Must Have |
| E7-S2 | Workspace-shared view library | Must Have |
| E7-S3 | Featured pinned views | Should Have |

**E7-S1: Save a view**

- **AC:** Given the user saves a view (current filters, overlays, domain focus, viewport, and
  **server-side layout** D2), then it is persisted with a required name. Name collision →
  overwrite/rename prompt.

**E7-S2: Workspace-shared view library**

- **AC:** Given the shared library, when opened, then workspace members can see all views scoped
  to their tenant + workspace. Creator deletes own; workspace admin (PLAT-SETTINGS-1) deletes any.
- **AC:** Given a saved view references now-deleted entities, then those are flagged on load.

**E7-S3: Featured pinned views**

- **AC:** Given admin-pinned views (limit default 5, tunable), then they appear prominently in the
  panel. Exceeding the limit → admin prompted to unpin another.

---

### EPIC-008 — Version Views & Diff · M2

**Milestone:** M2 · **Priority:** Must Have · **Consumes:** CE-VERSION-1, CE-READ-1, CE-DIFF-1 ·
**Blocked by:** EPIC-001

Load specific published versions read-only; visual diff between two versions.

**User stories**

| Task | Title | Priority |
|---|---|---|
| E8-S1 | View a specific published version | Must Have |
| E8-S2 | Compare two versions | Must Have |

**E8-S1: View a specific published version**

- **AC:** Given the Versions panel (via CE-VERSION-1), when a published version is selected, then
  the canvas loads that version via CE-READ-1 in read-only mode. Default canvas = **draft**;
  `latest` = newest published. The edit UI is disabled for all historical versions.

**E8-S2: Compare two versions**

- **AC:** Given two versions selected, when diff is requested, then the Explorer calls CE-DIFF-1
  and applies the diff overlay (green/red/amber incl. edge mods; see FR-016). JSON summary export
  available (PDF/CSV → OQ-06).

---

### EPIC-010 — Model-Completeness Map · M2 (new)

**Milestone:** M2 · **Priority:** Must Have · **Consumes:** CE-READ-1 (`coverage_gap` pattern) ·
**Ledger:** D6, D7, L2 · **Blocked by:** EPIC-001

Authors see which entities lack required links (e.g. `Process` missing `performedBy`,
`governedBy`, `triggeredBy`, `results`). Consumes the CE-READ-1 `coverage_gap(process)` query
pattern → `{entity_iri, missing_link}`. Closes legibility gap L2 (cold-start ramp). ([constitution-engine](constitution-engine.md) §coverage_gap · [contracts](../contracts.md) CE-READ-1)

**User stories**

| Task | Title | Priority |
|---|---|---|
| E10-S1 | View completeness overlay | Must Have |
| E10-S2 | Drill into a gap | Should Have |

**E10-S1: View completeness overlay**

- **AC:** Given a BA / ontologist opens the Model-Completeness view, when the overlay is enabled,
  then the Explorer calls CE-READ-1 `coverage_gap(process)` and overlays each returned
  `entity_iri` with a gap indicator (badge or colour); entities with no gaps are neutral.
- **AC:** Given the query returns an empty result (no gaps), then a "No coverage gaps found"
  confirmation is shown.
- **AC (failure):** Given a CE-READ-1 error, then a retry notice is shown; the canvas reverts to
  non-overlay state.

**E10-S2: Drill into a gap**

- **AC:** Given a gap-flagged entity is clicked, then the side panel lists the missing links from
  the `coverage_gap` result (`missing_link` values).
- **AC:** Given the side panel lists a missing link, then a shortcut action is available: either
  open the CE editing surface for that entity type, or — if E5 (visual editing) is active —
  initiate the relevant edge creation inline on the canvas.

**Epic-level acceptance criteria (EARS)**

- [ ] WHEN a BA enables the completeness overlay THE SYSTEM SHALL call CE-READ-1 `coverage_gap`
  and overlay gap indicators on the relevant entity nodes — verified by E10-S1 integration test
  against a CE stub returning known gaps.
- [ ] WHEN a BA clicks a gap-flagged node THE SYSTEM SHALL show the missing-link list in the side
  panel and offer a shortcut to the editing surface — verified by E10-S2 test.
- [ ] WHEN `coverage_gap` returns no rows THE SYSTEM SHALL show "No coverage gaps found" — verified
  by E10-S1 empty-state test.

---

### post-v1 — C4 Mode & Realtime Collaboration

*Nothing in this group is required for M1 or M2. GE-CANVAS-1 c4 mode and realtime collab are
sequenced after the M2 model→generate loop is proven.*

---

### EPIC-009 — Embeddable Canvas Component GE-CANVAS-1 · force mode M2, c4 mode post-v1

**Milestone:** M2/v1.0 (force mode) · post-v1 (c4 mode) · **Priority:** Must Have (force M2) ·
**Provides:** GE-CANVAS-1 · **Consumes:** CE-READ-1, CE-WRITE-1 · **Blocked by:** EPIC-001,
EPIC-005

Packages the force-directed canvas (built in E1) as an embeddable React component with props
`{source, filterByIri, mode:"force", readonly, version}`, provided to the Build Engine ([build-engine](build-engine.md)
GE-CANVAS-1 · [contracts](../contracts.md) §GE-CANVAS-1).

**GE-CANVAS-1 c4 mode is post-v1** (D4, SS-GE-2 resolved). Build M1 does not need GE-CANVAS-1 at
all ([weave-spec](../weave-spec.md) §1.2); force mode unblocks Build M2/v1.0. C4 mode is net-new (no productionised
prototype); budget at post-v1 tech spec.

**User stories**

| Task | Title | Priority | Milestone |
|---|---|---|---|
| E9-S1 | Embeddable force canvas (GE-CANVAS-1 force) | Must Have | M2/v1.0 |
| E9-S2 | C4 structured view (GE-CANVAS-1 c4) | Must Have | post-v1 |

**E9-S1: Embeddable force canvas**

- **AC:** Given the Build Engine mounts GE-CANVAS-1 with `{source, filterByIri, mode:"force",
  readonly, version}`, then the component renders the force-directed slice scoped to
  `filterByIri`; `readonly:true` disables editing; `version` pins the read.
- **AC:** Given a project-architecture edit via the embedded canvas (when `readonly:false`), then
  it writes back through CE-WRITE-1 (server-side authz boundary; never writes triples directly).
- **AC:** Given `filterByIri` matching no entities, then an empty-state is shown (no error).
- **AC (isolation):** Given the component mounted under a tenant-A context, then zero tenant-B
  entities appear regardless of `filterByIri`.

**E9-S2: C4 structured view (post-v1)**

Structured architecture view (C4 style) over the same graph. Net-new — no productionised
prototype. Architect must budget c4 mode distinctly from force mode at post-v1 tech spec.
Dependencies: OQ-02 analogue (c4 rendering approach); CE data model must expose structural kinds
(System, Service, BusinessCapability etc.) in the form required by the c4 layout.

**Epic-level acceptance criteria (EARS, M2)**

- [ ] WHEN the Build Engine mounts GE-CANVAS-1 with `mode:"force"` THE SYSTEM SHALL render the
  project-scoped slice and write a project-architecture edit back via CE-WRITE-1 — verified by the
  GE-CANVAS-1 contract conformance test.
- [ ] WHEN `filterByIri` matches no entities THE SYSTEM SHALL render an empty-state — verified.
- [ ] WHEN mounted under a tenant-A context THE SYSTEM SHALL return zero tenant-B entities.

---

## 4. Roadmap

**Program roadmap:** [weave-spec](../weave-spec.md) `../weave-spec.md` §Program. Cross-engine dependencies cite
contract IDs from [contracts](../contracts.md) `../contracts.md`.

### Position in the build order

Weave build order: **Platform (#1) → Constitution (#2) → Graph Explorer (#3) → Build (#4) →
Events (#5) → Onboarding (#6)**.

Explorer **#3** — the visualise half of the model→generate thin loop. M1 Explorer needs only
CE-READ-1 (and Platform auth + PLAT-SETTINGS-1). M2 adds CE-WRITE-1, CE-DIFF-1, CE-VERSION-1,
PLAT-NOTIFY-1. Explorer provides GE-CANVAS-1 (force, M2/v1.0) → unblocks Build #4.

**CE-EVENT-1 note:** M2 ships the CE-READ-1 poll fallback for live-refresh; the CE-EVENT-1
live-stream upgrade is a post-v1 dependency (CE owns it; Explorer activates when CE ships it).

### Milestone gantt

```mermaid
gantt
    title Graph Explorer — Milestone Roadmap
    dateFormat YYYY-MM-DD
    section M1 — Read-Only Legibility
        E1-S0 SPIKE OQ-01 benchmark + layout schema :spike, 2026-01-01, 5d
        E1 Whole-Company Canvas                     :e1, after spike, 7d
        E2 Drill-In & Domain Focus                  :e2, after e1, 5d
        HITL: M1 gate                               :milestone, m1gate, after e2, 0d
    section M2 — Editing & Collaboration
        E3 Filters & Layers                         :e3, after m1gate, 5d
        E4 Visual Overlays                          :e4, after e3, 5d
        E5 Visual Editing (CE-WRITE-1)              :e5, after e2, 7d
        E7 Saved Views & Layout                     :e7, after e4, 4d
        E6 Async Share & Comments                   :e6, after e7, 4d
        E8 Version Views & Diff                     :e8, after e3, 4d
        E10 Model-Completeness Map                  :e10, after e4, 4d
        E9 GE-CANVAS-1 force mode                  :e9, after e5, 4d
        HITL: M2 gate                               :milestone, m2gate, after e9, 0d
    section post-v1
        E9 GE-CANVAS-1 c4 mode                     :e9c4, after m2gate, 10d
        E6 Realtime co-edit / follow-me (Yjs)       :e6rt, after m2gate, 12d
        HITL: post-v1 gate                          :milestone, pv1gate, after e6rt, 0d
```

### M1 — Thin Proof: read-only legibility

**Goal:** Force canvas renders the whole-company graph; every role can navigate, spotlight, search,
drill into domains, and trace impact without RDF. Server-side layout persists. OQ-01 SPIKE resolves
the 10k-node risk and the WebGL escape-hatch go/no-go.

**Epics in M1:** E1 (Whole-Company Canvas, incl. E1-S0 SPIKE) · E2 (Drill-In & Domain Focus)

**Entry criteria (DoR):**

- [ ] M1 PRD approved; M1 tech spec approved (Aurora layout schema, OQ-01 harness definition).
- [ ] Upstream contracts stubbable: CE-READ-1, PLAT-SETTINGS-1, PLAT-IDENTITY-1.
- [ ] E1-S0 SPIKE scope defined; benchmark harness spec written.

**Exit criteria (EARS):**

- [ ] WHEN an authenticated viewer opens the Explorer THE SYSTEM SHALL render the draft graph as a
  Cytoscape/fcose force canvas coloured by BPMO kind, within default ≤ 3 s at 1k / ≤ 8 s at 10k
  nodes (p95, tunable) — verified by OQ-01 benchmark report.
- [ ] WHEN OQ-01 SPIKE fails (targets not met) THE SYSTEM SHALL have an Architect-signed WebGL
  escape-hatch decision (OQ-05) before M1 gate passes.
- [ ] WHEN a viewer searches and spotlights a node THE SYSTEM SHALL not expose a raw IRI — verified.
- [ ] WHEN a node is dragged THE SYSTEM SHALL persist the position server-side and restore on
  reload — verified by E1-S5 integration test.
- [ ] WHEN a user requests impact traversal THE SYSTEM SHALL use the OQ-09-confirmed predicate
  closure (not any hard-coded predicate list) — verified by E2-S3 test.
- [ ] WHEN any read is issued under a tenant-A JWT THE SYSTEM SHALL return zero tenant-B rows/triples.
- [ ] Coverage ≥ 80% (tunable) · mutation ≥ 70% (tunable) · 0 blocking bugs · zero axe-core
  violations on non-canvas UI in CI.
- [ ] **Measurable artefacts:** OQ-01 benchmark report; Aurora layout-schema approved; OQ-09
  predicate closure confirmed by CE team.
- [ ] **Human sign-off recorded** (PO + Tech lead).

**HITL gates:**

| Gate | Active? | Approver | Blocks |
|---|---|---|---|
| Spec-approval | **mandatory** | PO + EA stakeholder | M1 start |
| OQ-01 SPIKE sign-off | mandatory | Architect | E1-S1 performance AC |
| M1 phase-boundary (security review + mutation + coverage) | yes | PO + Tech lead | M2 start |
| Pre-AWS-deploy | yes | Tech lead | deploy |

### M2 — Fast-Follow: editing + overlays + async share

**Goal:** Visual editing (CE-WRITE-1); filters and overlays (heatmap, diff, domain, impact);
async share + comments; saved views with server-side layout; version views + diff; model-
completeness map; GE-CANVAS-1 force mode published to Build.

**Epics in M2:** E3 · E4 · E5 · E6 (S1–S3) · E7 · E8 · E10 (new) · E9 (force mode)

**Entry criteria (DoR):**

- [ ] M1 gate passed + human sign-off recorded.
- [ ] M2 PRD + tech spec approved; CRDT choice deferred (post-v1).
- [ ] CE-WRITE-1, CE-DIFF-1, CE-VERSION-1, PLAT-NOTIFY-1 available and stubbable.
- [ ] OQ-09 predicate closure confirmed (gates E2-S3 if not already M1-resolved).

**Exit criteria (EARS):**

- [ ] WHEN a BA adds a node THE SYSTEM SHALL commit via CE-WRITE-1, surface `422` as SHACL
  violation, and roll back on timeout with no orphan.
- [ ] WHEN the diff overlay is applied THE SYSTEM SHALL call CE-DIFF-1 and render
  added/removed/modified (incl. edges) — verified by E4-S2/E8-S2 test.
- [ ] WHEN a Saved View is shared THE SYSTEM SHALL notify eligible recipients via PLAT-NOTIFY-1
  and reproduce the same server-side layout for a different workspace user.
- [ ] WHEN a BA enables the completeness overlay THE SYSTEM SHALL call `coverage_gap` and overlay
  gap indicators — verified by E10-S1 integration test.
- [ ] WHEN Build mounts GE-CANVAS-1 (`mode:"force"`) THE SYSTEM SHALL render the project slice
  and write-back via CE-WRITE-1 — verified by GE-CANVAS-1 conformance test.
- [ ] WHEN any read is issued under a tenant-A JWT THE SYSTEM SHALL return zero tenant-B rows/triples.
- [ ] Coverage ≥ 80% · mutation ≥ 70% · 0 blocking bugs · zero axe-core violations on non-canvas UI.
- [ ] **Measurable artefacts:** GE-CANVAS-1 contract conformance report; cross-tenant isolation
  test report.
- [ ] **Human sign-off recorded** (PO + Tech lead).

**HITL gates:**

| Gate | Active? | Approver | Blocks |
|---|---|---|---|
| Spec-approval | **mandatory** | PO + EA stakeholder | M2 start |
| M2 phase-boundary (security + mutation + coverage) | yes | PO + Tech lead | post-v1 start |
| Pre-AWS-deploy | yes | Tech lead | deploy |
| GE-CANVAS-1 force-mode release (provided to Build) | **yes** | PO + Tech lead | Build M2 unblock |

### post-v1 — C4 Mode & Realtime Collaboration

**Goal:** Figma-style live multi-user collaboration (Yjs CRDT, presence, cursors, follow-me) plus
GE-CANVAS-1 c4 (structured architecture view) — both sequenced after M2 closes the model→generate
loop.

**Entry criteria:** M2 gate passed; OQ-02/OQ-07 (Yjs transport + follow-me) resolved; CE-EVENT-1
shipped; post-v1 PRD + tech spec (CRDT sync transport, tenant-scoped rooms, c4 renderer) approved.

**Exit criteria (EARS):**

- [ ] WHEN ≥ 2 users are live in a session (default 5 concurrent) THE SYSTEM SHALL show cursors and
  reflect drags with ≤ 500 ms p95, authoritative writes via CE-WRITE-1 — verified by multi-user
  convergence test.
- [ ] WHEN a client connects to a CRDT sync room THE SYSTEM SHALL validate JWT tenant claim and
  reject a tenant mismatch at connect.
- [ ] WHEN sync drops and reconnects THE SYSTEM SHALL converge with no lost updates.
- [ ] WHEN CE-EVENT-1 emits a change THE SYSTEM SHALL reconcile in place (replacing poll fallback).
- [ ] WHEN Build mounts GE-CANVAS-1 (`mode:"c4"`) THE SYSTEM SHALL render the C4 structured view.
- [ ] **Human sign-off recorded.**

### HITL gate summary

| Gate | After phase | Approval criteria | Approver |
|---|---|---|---|
| Spec-approval | Before each milestone | PRD/tech-spec approved | PO + EA stakeholder |
| OQ-01 SPIKE sign-off | M1 (early) | Benchmark report + WebGL decision if needed | Architect |
| M1 gate | M1 | All M1 EARS exit criteria met + coverage/mutation floors + OQ-01 report + OQ-09 confirmed + human sign-off | PO + Tech lead |
| GE-CANVAS-1 force-mode release | M2 | Contract conformance test passed | PO + Tech lead |
| M2 gate | M2 | All M2 EARS exit criteria met + coverage/mutation + GE-CANVAS-1 conformance + human sign-off | PO + Tech lead |
| post-v1 gate | post-v1 | Multi-user convergence + tenant-isolation test reports + human sign-off | PO + Tech lead |
