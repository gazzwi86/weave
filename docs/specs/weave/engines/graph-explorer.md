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
  live-refresh by polling the **CE-EVENT-1 beta seq feed** (`GET /api/events?since_seq={n}` —
  the polled transport; draft commits arrive as `version_iri: null` rows). Push fan-out is a
  post-v1 additive upgrade.
- Saved Views (E7): save filters/overlays/domain/viewport/layout; tenant-shared library;
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
- **CE-EVENT-1 push fan-out upgrade** (SNS/WebSocket) of live-refresh — M2 already consumes
  the seq feed by polling.

#### Out of Scope

- Model, store, SHACL validation, OWL reasoning — Constitution Engine owns these.
- Versioning lifecycle (draft → published, PROV-O) — CE; Explorer visualises.
- Raw SPARQL query authoring — CE Query screen.
- Automation flow canvas — Events & Actions Engine.
- Project kanban / PM graph views — Build Engine (Build embeds GE-CANVAS-1 slice).

### Target Users

Per-persona feed/consume detail lives in the program persona map, [`../personas.md`](../personas.md).
The `ontologist` role slug used for IRI disclosure below is the **Enterprise architect** canonical
role (weave-platform.md §Engine persona → canonical role mapping).

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
- Saved views, layout, and comments are Explorer-owned Aurora tables (tenant-scoped —
  workspace ≡ company/tenant post workspace-drop); not inter-engine contracts.
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
| FR-021 | Side-panel edit of label/comment/typed props via CE-WRITE-1 (`update_node`); PROV-O + PLAT-AUDIT-1 stamp; concurrency = GE-side since-version drift guard (save against a moved draft head blocked with conflict notice + current values; no-drift = LWW, both commit as successive CE versions — CE-WRITE-1 M2 has no conditional write/`409`; ADR-008) | E5-S3 | P0 | M2 |
| FR-022 | Delete node/edge via CE-WRITE-1: GE first reads the FULL incident-edge set (outbound AND inbound) via CE-READ-1, warns with the reference count, then submits ONE batch of incident-edge deletes + the node delete (CE applies exactly the submitted ops — no server-side cascade); on `201` canvas removes exactly the submitted IRIs; failure → nothing removed | E5-S4 | P0 | M2 |
| FR-023 | Async share of a Saved View → recipient notified via PLAT-NOTIFY-1; recipients lacking access excluded (no leak) | E6-S1 | P0 | M2 |
| FR-024 | Comments on node/view persisted server-side (Explorer Aurora, tenant-scoped); failed write → draft preserved + retry | E6-S2 | P0 | M2 |
| FR-025 | Live refresh: poll the CE-EVENT-1 beta seq feed (`GET /api/events?since_seq={n}`, default 30 s tunable; draft commits = `version_iri: null` rows; `410 Gone` → re-baseline via CE-READ-1); push fan-out upgrade post-v1 | E6-S3 | P1 | M2 (seq-feed poll) / post-v1 (push) |
| FR-026 | Realtime co-edit + presence/cursors (Yjs, default 5 concurrent / ≤500 ms p95, tunable); CRDT room id includes tenant id, JWT tenant validated at connect | E6-S4 | Won't-M2/Must-pv1 | post-v1 |
| FR-027 | Workshop "Follow me" (viewport-only sync) | E6-S5 | Won't-M2/Should-pv1 | post-v1 |
| FR-028 | Save view (filters, overlays, domain focus, viewport, **server-side layout**); name required; collision → overwrite/rename prompt | E7-S1 | P0 | M2 |
| FR-029 | Tenant-shared view library; creator deletes own, tenant admin (roles claim via PLAT-IDENTITY-1, resolved through PLAT-SETTINGS-1) deletes any; missing entities flagged | E7-S2 | P0 | M2 |
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
- Live refresh polls the CE-EVENT-1 seq feed (default 30 s) without blocking the user; an
  aged-out cursor (`410 Gone`) re-baselines via CE-READ-1 — never a silent empty page.
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
unscoped query. Explorer-owned Aurora tables carry `tenant_id` on every row (fail-closed RLS).

**Required test:** WHERE a tenant-A JWT is presented, WHEN any Explorer read is issued (graph load,
Saved View list, comment fetch, diff) THE SYSTEM SHALL return **zero tenant-B rows/triples**; IF an
attempt is made to address a tenant-B view id or room (post-v1) THEN THE SYSTEM SHALL reject it.

**Browser:** Chrome, Firefox, Safari — latest 2 major versions. Desktop-first; no mobile in v1.

### 2.3 Inter-engine interfaces

> Contracts by ID from [contracts](../contracts.md) (`../contracts.md`). Consumed contracts version-pinned (B2/CE-VERSION-1).

**Consumed (Explorer calls / reads)**

| Provider | Contract | Used for | Milestone |
|---|---|---|---|
| Constitution Engine | CE-READ-1 (`/api/ontology/types|resource|versions`, `/api/sparql` SELECT/paginated) | Graph load, palette (GE's `/api/proxy/node-kinds` route is a GE-owned projection of `/api/ontology/types` — CE serves no `/api/node-kinds`), spotlight props, impact traversal, version load, `coverage_gap` query | M1 |
| Constitution Engine | CE-WRITE-1 (`POST /api/operations/apply`) | All node/edge add/update/delete; authz boundary; Build canvas write-back | M2 |
| Constitution Engine | CE-DIFF-1 (`/api/ontology/diff?from&to`) | Diff overlay incl. edge mods | M2 |
| Constitution Engine | CE-VERSION-1 (`/api/ontology/versions`) | Version list + lag for Versions panel | M2 |
| Constitution Engine | CE-EVENT-1 (beta seq feed `GET /api/events?since_seq={n}`) | Live in-place refresh — M2 polls the seq feed (draft rows `version_iri: null`; `410` → re-baseline via CE-READ-1); push fan-out post-v1 | M2 (poll) / post-v1 (push) |
| Platform | PLAT-NOTIFY-1 | Share notifications | M2 |
| Platform | PLAT-SETTINGS-1 | Tenant-admin RBAC (three-level cascade Company → Domain → Project); tenant scope of views/comments/layout | M1 |
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
| OQ-06 | **Resolved (M2):** JSON-only export in M2; PDF/CSV deferred post-v1, revisit on compliance demand; no CE report endpoint requested — see tech-spec/m2-delta.md §1. | Architect + Compliance |
| OQ-07 | post-v1: "Follow me" transport: shared Yjs vs separate broadcast channel. | Architect |
| OQ-08 | Kind→shape and relationship-type→stroke visual mapping (net-new design; beyond colour-only prototype). | PO + Design |
| OQ-09 | **Resolved (M2, ADR-005):** 13-entry directed closure (incl. `hasField`, now in the contracts.md CE-READ-1 relationship list), shipped as config with a boot-time drift guard against `GET /api/ontology/types`. | Architect + CE |
| OQ-10 | ODRL policy enforcement not in v1; PII/sensitive uses SHACL + data-classification properties. Whether any overlay must surface data-classification deferred. | Architect |
| OQ-11 | **Resolved (M2, ADR-006):** `actor` = JWT `principal_iri` claim (PLAT-IDENTITY-1), injected proxy-side; never raw Cognito identity, never client-supplied. | Architect + Platform |

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
  PLAT-NOTIFY-1, and reproduced for a different user in the same tenant.
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

- **AC (go):** WHERE the harness result is available, WHEN Cytoscape meets ≤ 8 s load / 60 fps drag
  at 10k nodes THE SYSTEM SHALL pass the SPIKE and the E1-S1 performance criterion SHALL stand.
- **AC (no-go):** WHERE the harness result is available, IF Cytoscape does not meet targets THEN the
  Architect SHALL raise the OQ-05 decision (WebGL escape hatch — sigma.js/G6) and build of E1-S1
  SHALL be paused until the renderer decision is made.
- **Owner:** Architect. **Blocks:** E1-S1 performance AC, all 10k NFRs.
- **ALSO (layout schema):** Design and approve the Explorer-owned Aurora layout-schema
  (tenant_id, workspace_id, graph_id, node_iri, position_x, position_y, locked). Blocks E1-S5.
  *(M1-shipped column set; `workspace_id` is residual post workspace-drop — the rename is the
  tracked refactor per contracts.md §PLAT-SETTINGS-1 "M1 transition". M2 specs key on
  `(tenant_id, graph_id)`.)*

**E1-S1: View the whole company graph on load**

- **AC:** WHERE an authenticated user is present, WHEN the Explorer opens THE SYSTEM SHALL load the
  nodes and edges of the current **draft** graph via CE-READ-1 and render them in the Cytoscape/fcose
  force canvas (fcose params at tech spec; randomize/auto-layout runs only for nodes lacking saved
  positions).
- **AC:** WHERE the graph is loaded, WHEN it is rendered THE SYSTEM SHALL colour each node by its CE
  BPMO kind (palette derived from CE-READ-1 `GET /api/ontology/types` via the GE-owned
  `/api/proxy/node-kinds` projection route — CE serves no `/api/node-kinds` endpoint; client
  palette fallback only). The
  palette SHALL cover every BPMO kind with grey fallback for unrecognised/extension kinds, `Process`
  SHALL take a prominent hue, and node shape SHALL be a single ellipse in v1 (kind→shape deferred,
  OQ-08).
- **AC (failure):** IF CE-READ-1 returns an error or times out (default 10 s, tunable) when the canvas
  tries to load THEN THE SYSTEM SHALL show an empty-state with retry and the CE error message, with no
  partial render.
- **AC (performance — gated on E1-S0 SPIKE):** WHERE the OQ-01 reference hardware is used, WHEN the
  Explorer loads THE SYSTEM SHALL complete first interactive render within default ≤ 3 s at 1k / ≤ 8 s
  at 10k nodes (p95), tunable — verified by the OQ-01 benchmark harness.

**E1-S2: Pan, zoom, navigate**

- **AC:** WHERE the canvas is shown, WHEN the user scrolls/pinches THE SYSTEM SHALL zoom the canvas;
  WHEN the user presses Cmd/Ctrl+0 THE SYSTEM SHALL fit the graph to screen.
- **AC:** WHERE semantic zoom thresholds apply (default 0.55× edge-label, 0.3× node-label, tunable),
  WHEN zoom crosses a threshold THE SYSTEM SHALL hide/show labels accordingly (edge labels on hover
  when visible).
- **AC:** WHERE the canvas is rendered THE SYSTEM SHALL show a mini-map (bottom-right) tracking the
  viewport position.
- **AC (failure):** WHERE a Cmd+0 / Cmd+K binding collision exists, IF the canvas lacks focus THEN THE
  SYSTEM SHALL NOT fire the canvas handler (no global capture).

**E1-S3: Spotlight a node**

- **AC:** WHEN a node is clicked THE SYSTEM SHALL keep its `closedNeighborhood` at full opacity and
  dim all other elements to default 0.18 opacity (tunable).
- **AC:** WHERE spotlight is active, WHEN the side panel opens THE SYSTEM SHALL show label,
  human-readable type, and key property values from CE. THE SYSTEM SHALL NOT show the **raw IRI** in
  the default panel; it SHALL reveal it only under "Advanced / technical details" for ontologist-role
  users.
- **AC (failure):** WHEN a background click or Escape occurs THE SYSTEM SHALL clear the spotlight; IF
  the side-panel property fetch fails THEN THE SYSTEM SHALL show the label + type already loaded with a
  "details unavailable" notice.

**E1-S4: Search for a node by name or type**

- **AC:** WHEN Cmd/Ctrl+K is pressed (or the sidebar search takes focus) THE SYSTEM SHALL open a
  search overlay and highlight nodes matching on `rdfs:label`, `skos:prefLabel`, and entity-type
  label, dimming non-matching nodes.
- **AC:** WHEN a search result is clicked THE SYSTEM SHALL centre the canvas on that node and
  spotlight it.
- **AC (failure):** IF Cmd+K is not available (browser focus absent) THEN THE SYSTEM SHALL NOT fire
  the binding and SHALL keep sidebar search available.

**E1-S5: Persist and reset layout (server-side, D2)**

- **AC:** WHERE a node is dragged, WHEN the drag ends THE SYSTEM SHALL persist its position
  **server-side** scoped per (tenant, project, graphId) — not in localStorage; on next Explorer open
  THE SYSTEM SHALL apply saved positions before fcose runs.
- **AC:** WHEN "Reset layout" is clicked THE SYSTEM SHALL clear server-side positions and re-run fcose
  from scratch.
- **AC (failure):** IF a position save fails THEN THE SYSTEM SHALL hold the position optimistically in
  memory with background retry and SHALL never silently drop it.
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

- **AC:** WHERE a domain node is right-clicked, WHEN "Focus domain" is selected THE SYSTEM SHALL
  filter the canvas to that domain's members and de-emphasise the rest of the graph.
- **AC:** WHERE a domain is empty, WHEN it is focused THE SYSTEM SHALL show an empty-state.
- **AC (failure):** IF a CE-READ-1 error occurs on domain member fetch THEN THE SYSTEM SHALL show an
  error notice and restore the full graph.

**E2-S2: Expand / collapse neighbourhood**

- **AC:** WHERE a node is spotlighted, WHEN the user requests neighbour expansion THE SYSTEM SHALL
  load and attach the immediate neighbours in the canvas.
- **AC:** IF expansion would add > default 500 nodes (tunable) THEN THE SYSTEM SHALL show a "Load N
  more nodes — continue?" confirm before fetching.
- **AC:** WHEN a collapse follows an expand THE SYSTEM SHALL retract the neighbours while keeping the
  focus node visible.

**E2-S3: Impact / dependency trace** *(SS-GE-4 fix — no hard-coded predicates)*

- **AC:** WHERE a node is spotlighted, WHEN the user requests impact/dependency traversal THE SYSTEM
  SHALL send a SPARQL property-path SELECT to CE-READ-1 using **the predicate closure confirmed
  against the shipped BPMO relationship types (OQ-09 — resolved before E2-S3 is built)**, traversing
  to depth default all / cap N (default 6, tunable).
- **AC:** WHEN traversal results arrive THE SYSTEM SHALL highlight nodes already on canvas, auto-load
  off-canvas nodes (up to cap) or badge them as "N more in chain", and SHALL never silently truncate.
- **AC:** WHERE the impact overlay is enabled THE SYSTEM SHALL persist the pinned result through
  pan/zoom; WHEN the source node is deleted THE SYSTEM SHALL auto-clear the overlay.
- **AC (failure):** IF CE-READ-1 returns an error THEN THE SYSTEM SHALL leave traversal results empty
  with an error notice and SHALL leave existing canvas elements unaffected.
- **Blocked by:** OQ-09 resolved and predicate closure confirmed at CE data-model stage.

**Epic-level acceptance criteria (EARS)**

- [ ] WHEN a viewer right-clicks a domain and selects "Focus domain" THE SYSTEM SHALL filter the
  canvas to that domain's members via CE-READ-1 — verified by E2-S1 test.
- [ ] WHEN a viewer requests impact traversal THE SYSTEM SHALL send a property-path SELECT using
  the OQ-09-confirmed predicate closure; results highlight on-canvas and badge off-canvas nodes;
  depth is capped and tunable — verified by E2-S3 test with a testable example graph.
- [ ] Coverage ≥ 80% (tunable) · mutation ≥ 60% (tunable) · 0 blocking bugs.

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

- **AC:** WHERE the entity-type toggle panel is shown, WHEN a type is toggled off THE SYSTEM SHALL
  hide its nodes + incident edges and re-flow the layout; WHEN all types are off THE SYSTEM SHALL show
  an empty-state.
- **AC (failure):** IF a toggle results in an empty graph THEN THE SYSTEM SHALL show an empty-state
  (not a blank canvas).

**E3-S2: Relationship-type toggles**

- **AC:** WHERE relationship-type toggles (multi-select) are shown, WHEN a type is toggled off THE
  SYSTEM SHALL hide its edges and de-emphasise (not remove) orphaned nodes.

**E3-S3: Property filter builder**

- **AC:** WHERE the filter builder (type + path + operator + value, AND logic, chip display) is used,
  WHEN a filter is applied THE SYSTEM SHALL keep matching nodes highlighted and dim non-matching ones.
  **Client-side over loaded nodes only — not a CE query.**
- **AC:** IF a property path is not present on any loaded node THEN THE SYSTEM SHALL treat all nodes as
  non-matching (no error).

**E3-S4: Governed-content layers**

- **AC:** WHERE governed-content layer toggles (Glossary / Brand / Governance) are shown, WHEN one is
  toggled on THE SYSTEM SHALL load and overlay the relevant content nodes via CE-READ-1.
- **AC:** IF a layer is empty (no governed content) THEN THE SYSTEM SHALL disable the toggle with a
  tooltip.

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

- **AC:** WHERE the heatmap is enabled (maturity / investment / strategy / lifecycle dimensions), WHEN
  it is applied THE SYSTEM SHALL colour nodes by the **prototype value→colour mapping** and render
  unmatched values as grey with a count in the legend.
- **AC:** WHERE overlays are mutually exclusive, WHEN the heatmap is active THE SYSTEM SHALL disable
  the diff overlay (and vice versa).

**E4-S2: Version diff overlay**

- **AC:** WHERE two published versions are selected, WHEN diff is applied THE SYSTEM SHALL call
  CE-DIFF-1 and overlay added (green) / removed (red, default 0.35 opacity, tunable) / modified incl.
  **edge modifications** (amber); WHEN the versions are identical THE SYSTEM SHALL show a "no
  differences" banner.
- **AC (failure):** IF CE-DIFF-1 errors THEN THE SYSTEM SHALL show a retry banner and leave the
  existing canvas unchanged.

**E4-S3: Pinned impact overlay**

- **AC:** WHERE an impact traversal (E2-S3) result is pinned THE SYSTEM SHALL persist the overlay
  through pan/zoom/filter changes.
- **AC:** WHEN the source node is deleted THE SYSTEM SHALL auto-clear the pinned overlay.

**E4-S4: Domain colouring layer**

- **AC:** WHERE domain colouring is enabled THE SYSTEM SHALL colour nodes by their domain membership
  (mutually exclusive with type colouring in v1), cycle the palette on overflow, and show the mapping
  in the legend.

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

- **AC:** WHERE a BA / ontologist user is present, WHEN double-clicking the canvas THE SYSTEM SHALL
  optimistically render a new node and commit it via CE-WRITE-1 (`add_node`).
- **AC:** IF CE-WRITE-1 returns `422` THEN THE SYSTEM SHALL show the SHACL violation as human-readable
  text and remove the optimistic node.
- **AC:** IF CE-WRITE-1 times out (default 10 s, tunable) THEN THE SYSTEM SHALL roll back the
  optimistic node, leaving no orphan on canvas.

**E5-S2: Draw edge**

- **AC:** WHERE an edgehandles drag is in progress (prototype params, tunable; self-loop blocked),
  WHEN the edge is released on a valid target THE SYSTEM SHALL commit the edge via CE-WRITE-1
  optimistically.
- **AC:** IF a timeout or `422` occurs THEN THE SYSTEM SHALL roll back the optimistic edge.

**E5-S3: Edit node properties**

- **AC:** WHERE a BA / ontologist edits a node's label/comment/typed props in the side panel, WHEN it
  is saved THE SYSTEM SHALL call CE-WRITE-1 (`update_node`) and CE SHALL write a PROV-O + PLAT-AUDIT-1
  stamp (actor = the JWT `principal_iri` claim, injected proxy-side — ADR-006; supersedes the
  earlier "Cognito identity" wording).
- **AC:** WHERE the draft head has advanced since an edit began, WHEN save is attempted THE SYSTEM
  SHALL block the commit and show a conflict notice with the current server values (GE-side
  since-version drift guard — ADR-008); WHERE no drift is detected, concurrent edits of the same
  property SHALL resolve last-write-wins with BOTH commits succeeding as successive CE versions
  (CE-WRITE-1 M2 has no conditional write / `409`).

**E5-S4: Delete node / edge**

- **AC:** WHERE a delete action is taken THE SYSTEM SHALL first read the node's FULL incident-edge
  set — outbound AND inbound edges — via CE-READ-1, warn with the total reference count, and on
  confirm submit ONE CE-WRITE-1 batch containing every incident-edge delete plus the node delete
  (CE applies exactly the submitted ops — no server-side cascade; a batch that leaves dangling
  references `422`s whole).
- **AC:** WHEN the batch returns `201` THE SYSTEM SHALL remove from canvas exactly the submitted
  IRIs — nothing more, nothing inferred.
- **AC:** IF CE-WRITE-1 fails THEN THE SYSTEM SHALL remove nothing from canvas.

**Epic-level acceptance criteria (EARS)**

- [ ] WHEN a BA double-clicks to add a node THE SYSTEM SHALL commit via CE-WRITE-1, surface `422`
  as human-readable SHACL violation, and roll back on timeout — verified by E5-S1 integration test.
- [ ] WHEN a save is attempted against a moved draft head THE SYSTEM SHALL block it with a
  conflict notice + current server values; no-drift concurrent edits are LWW with both commits
  succeeding (ADR-008) — verified by `test_drift_guard_blocks_save_and_shows_current` and
  `test_lww_when_no_drift_detected`.
- [ ] All write paths carry PROV-O attribution and PLAT-AUDIT-1 stamp — verified by audit log check.

---

### EPIC-006 — Async Share & Comments · M2

**Milestone:** M2 (async share + comments + live-refresh poll) ·
post-v1 (realtime co-edit, follow-me, CE-EVENT-1 push fan-out) ·
**Consumes:** PLAT-NOTIFY-1, CE-EVENT-1 (M2 seq-feed poll; push post-v1), CE-READ-1
(re-baseline) · **Blocked by:** EPIC-001, EPIC-007

M2 stories ship async collaboration (S1–S3). Post-v1 stories (S4–S5) are stubs here.

**User stories**

| Task | Title | Priority | Milestone |
|---|---|---|---|
| E6-S1 | Share a saved view | Must Have | M2 |
| E6-S2 | Comment on a node or view | Must Have | M2 |
| E6-S3 | Live-refresh (seq-feed poll) | Should Have | M2 |
| E6-S4 | Realtime co-edit + presence (Yjs) | Won't-M2 / Must-pv1 | post-v1 |
| E6-S5 | Workshop "Follow me" | Won't-M2 / Should-pv1 | post-v1 |

**E6-S1: Share a saved view**

- **AC:** WHEN a user shares a Saved View THE SYSTEM SHALL notify eligible recipients via
  PLAT-NOTIFY-1 and SHALL exclude recipients without graph access (no cross-user data leak).

**E6-S2: Comment on a node or view**

- **AC:** WHEN a comment is submitted on a node or view THE SYSTEM SHALL persist it server-side
  (Explorer Aurora, tenant-scoped); IF the write fails THEN THE SYSTEM SHALL preserve the
  draft and retry.

**E6-S3: Live-refresh (seq-feed poll)**

- **AC:** WHILE the Explorer is open THE SYSTEM SHALL poll the CE-EVENT-1 beta seq feed
  (`GET /api/events?since_seq={n}`, default 30 s, tunable) for graph changes — including draft
  commits (`version_iri: null` rows) — and reconcile them in place.
- **AC:** IF the seq cursor has aged out (`410 Gone`) THEN THE SYSTEM SHALL re-baseline via
  CE-READ-1 (full reload) — never a silent empty page.
- **AC:** WHEN push fan-out ships (post-v1) THE SYSTEM SHALL replace the poll loop with the push
  transport, keeping the user experience equivalent.

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
| E7-S2 | Tenant-shared view library | Must Have |
| E7-S3 | Featured pinned views | Should Have |

**E7-S1: Save a view**

- **AC:** WHEN the user saves a view (current filters, overlays, domain focus, viewport, and
  **server-side layout** D2) THE SYSTEM SHALL persist it with a required name; IF the name collides
  THEN THE SYSTEM SHALL prompt to overwrite or rename.

**E7-S2: Tenant-shared view library**

- **AC:** WHERE the shared library exists, WHEN it is opened THE SYSTEM SHALL let tenant members
  see all views scoped to their tenant; a creator SHALL be able to delete their own and a
  tenant admin (roles claim via PLAT-IDENTITY-1, resolved through PLAT-SETTINGS-1) SHALL be able
  to delete any.
- **AC:** IF a saved view references now-deleted entities THEN THE SYSTEM SHALL flag them on load.

**E7-S3: Featured pinned views**

- **AC:** WHERE views are admin-pinned (limit default 5, tunable) THE SYSTEM SHALL show them
  prominently in the panel; IF the limit is exceeded THEN THE SYSTEM SHALL prompt the admin to unpin
  another.

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

- **AC:** WHERE the Versions panel (via CE-VERSION-1) is shown, WHEN a published version is selected
  THE SYSTEM SHALL load that version via CE-READ-1 in read-only mode. Default canvas = **draft**;
  `latest` = newest published. THE SYSTEM SHALL disable the edit UI for all historical versions.

**E8-S2: Compare two versions**

- **AC:** WHERE two versions are selected, WHEN diff is requested THE SYSTEM SHALL call CE-DIFF-1 and
  apply the diff overlay (green/red/amber incl. edge mods; see FR-016) and SHALL make a JSON summary
  export available (PDF/CSV → OQ-06).

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

- **AC:** WHERE a BA / ontologist opens the Model-Completeness view, WHEN the overlay is enabled THE
  SYSTEM SHALL call CE-READ-1 `coverage_gap(process)` and overlay each returned `entity_iri` with a
  gap indicator (badge or colour), leaving entities with no gaps neutral.
- **AC:** IF the query returns an empty result (no gaps) THEN THE SYSTEM SHALL show a "No coverage
  gaps found" confirmation.
- **AC (failure):** IF a CE-READ-1 error occurs THEN THE SYSTEM SHALL show a retry notice and revert
  the canvas to non-overlay state.

**E10-S2: Drill into a gap**

- **AC:** WHEN a gap-flagged entity is clicked THE SYSTEM SHALL list the missing links from the
  `coverage_gap` result (`missing_link` values) in the side panel.
- **AC:** WHERE the side panel lists a missing link THE SYSTEM SHALL offer a shortcut action: either
  open the CE editing surface for that entity type, or — IF E5 (visual editing) is active — initiate
  the relevant edge creation inline on the canvas.

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

- **AC:** WHEN the Build Engine mounts GE-CANVAS-1 with `{source, filterByIri, mode:"force",
  readonly, version}` THE SYSTEM SHALL render the force-directed slice scoped to `filterByIri`;
  `readonly:true` SHALL disable editing and `version` SHALL pin the read.
- **AC:** WHEN a project-architecture edit is made via the embedded canvas (with `readonly:false`) THE
  SYSTEM SHALL write it back through CE-WRITE-1 (server-side authz boundary; never writing triples
  directly).
- **AC:** IF `filterByIri` matches no entities THEN THE SYSTEM SHALL show an empty-state (no error).
- **AC (isolation):** WHERE the component is mounted under a tenant-A context THE SYSTEM SHALL show
  zero tenant-B entities regardless of `filterByIri`.

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

**CE-EVENT-1 note:** M2 polls CE-EVENT-1's beta seq feed (`GET /api/events?since_seq={n}`) for
live-refresh — the seq feed IS the polled transport; the push fan-out upgrade is post-v1 (CE
owns it; Explorer swaps the poll loop for push when it ships).

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
- [ ] OQ-09 predicate-closure hand-off from CE M1 data-model on the M1 board — gates TASK-005 AC-6/AC-7.

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
- [ ] Coverage ≥ 80% (tunable) · mutation ≥ 60% (tunable) · 0 blocking bugs · zero axe-core
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
  and reproduce the same server-side layout for a different user in the same tenant.
- [ ] WHEN a BA enables the completeness overlay THE SYSTEM SHALL call `coverage_gap` and overlay
  gap indicators — verified by E10-S1 integration test.
- [ ] WHEN Build mounts GE-CANVAS-1 (`mode:"force"`) THE SYSTEM SHALL render the project slice
  and write-back via CE-WRITE-1 — verified by GE-CANVAS-1 conformance test.
- [ ] WHEN any read is issued under a tenant-A JWT THE SYSTEM SHALL return zero tenant-B rows/triples.
- [ ] Coverage ≥ 80% · mutation ≥ 60% · 0 blocking bugs · zero axe-core violations on non-canvas UI.
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
- [ ] WHEN CE-EVENT-1 push fan-out emits a change THE SYSTEM SHALL reconcile in place (replacing
  the M2 seq-feed poll loop).
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
