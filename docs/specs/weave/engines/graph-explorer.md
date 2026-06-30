---
type: EngineSpec
title: "Weave — Graph Explorer (consolidated)"
description: "The visual canvas onto the company graph: force-directed network, drill-in focus, C4 mode, validated visual editing, async share, and the embeddable GE-CANVAS-1 component (realtime collaboration is Phase 2)."
tags: [graph-explorer, consolidated]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/weave/engines/graph-explorer.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-30
owner: gazzwi86
coverage: n/a
---

# Graph Explorer

> The Weave Graph Explorer is the visual canvas onto the company graph — so business and technical
> users can see their entire operating model as a navigable, force-directed network, drill into any
> part of it, and shape it through validated visual edits. It turns the Constitution Engine's formal
> RDF/OWL model into something a whole organisation can see, understand, and work on, rather than a
> model only experts can read. In the MVP this is single-user editing plus **asynchronous** sharing
> (team-shared saved views and comments); Figma-style **real-time multi-user collaboration is a
> Phase 2 capability**, not part of the MVP.

## 1. Brief

### Mission Statement

We are building the Weave Graph Explorer — the visual canvas onto the company graph — so that
business and technical users can see their entire operating model as a navigable, force-directed
network, drill into any part of it, and shape it through validated visual edits. It turns the
Constitution Engine's formal RDF/OWL model into something a whole organisation can actually see,
understand, and work on, rather than a model only experts can read. In the MVP this is single-user
editing plus **asynchronous** sharing (team-shared saved views and comments); Figma-style
**real-time multi-user collaboration is a Phase 2 capability**, not part of the MVP.

### Problem

A formal model of the business is only valuable if people can actually see and navigate it — and
today they cannot.

- **Formal models are unreadable to humans.** An RDF/OWL graph is precise but opaque; without a
  visual surface, only ontologists can read it, so the very people who hold the operating knowledge
  cannot see the model that is supposed to describe their work.
- **Generic graph tools are static and solitary.** Existing ontology and diagramming tools render
  fixed pictures one person edits at a time; they do not let a whole organisation explore a large,
  living graph, drill into the part they care about, and work on it together.
- **No shared way to collaborate on the operating model.** Modelling a company is inherently a group
  activity — ops, architecture, compliance, and leadership all hold pieces — but there is no shared
  canvas where they explore the same graph, share curated views, and discuss changes. (Live
  co-editing is the eventual goal; the MVP solves the shared-lens and async discussion problem first.)
- **The whole is invisible.** People understand their own silo but cannot see how domains, systems,
  processes, and data interconnect, so cross-cutting impact and dependencies stay hidden.

The people who feel this are **everyone who needs to understand the company** — operations and
business staff, architects, compliance, and leadership — none of whom can read raw RDF. If this is
not solved, the Constitution Engine's model stays locked behind expert tooling: the graph exists,
but the organisation cannot see itself in it, so adoption stalls and the model is never collectively
trusted or maintained.

### Vision

Within 12 months, success for the Graph Explorer looks like:

- **The whole company is visible at a glance.** A user opens the Explorer and sees their operating
  model as a navigable, force-directed network — domains, systems, processes, data, and people and
  how they interconnect — not a wall of RDF.
- **Anyone can drill in and focus.** From the whole-company view a user zooms into a single node,
  domain, or process and sees just its neighbourhood and relationships, then back out again, without
  losing their place.
- **People work on it together (async in MVP; live in Phase 2).** In the MVP, a user shapes the graph
  single-user and shares curated saved views, with colleagues commenting asynchronously, so a team
  builds a shared understanding. Figma-style live co-editing with presence and cursors arrives in
  Phase 2.
- **Two views over one graph.** A force-directed network for exploration AND a structured C4-style
  view for architecture — both modes of one embeddable canvas component owned by the Explorer
  (force | c4). The Build Engine embeds a project-scoped slice of this canvas.
- **Visual edits are safe edits.** Changes made on the canvas go through the Constitution Engine's
  validated operations (SHACL), so visual editing never produces an invalid or untrusted model; the
  authoritative authorisation and validation boundary is the Constitution Engine's write endpoint,
  not the canvas UI.
- **Non-experts navigate confidently.** Business and operations staff explore and understand the
  model with no RDF or SPARQL knowledge, finding what they need through the visual surface.
- **Cross-cutting impact becomes obvious.** Users can see dependencies and impact across domains —
  what a system touches, what a process depends on — making hidden interconnections visible.
- **Versions are visible and navigable.** The Explorer presents the ontology, glossary, and graph as
  versioned artefacts with a visible change log — users can view a specific published version, see
  what changed between versions, and understand that projects and automations are pinned to a known
  version rather than a moving target. (The underlying draft → published versioning lifecycle and
  PROV-O provenance are owned by the Constitution Engine; the Explorer visualises them.)

### Scope

#### In Scope

**Visualisation**

- A force-directed network view of the whole company graph — typed entities (the process-centric
  **BPMO framework** kinds and relationship types served by the Constitution Engine, with `Process`
  at the centre, plus client-defined extensions on top of that grammar), their relationships, and
  governed content.
- Drill-in focus views: zoom into a node, domain, or process and its neighbourhood, with search,
  filtering, and navigation that keep the user oriented.
- Cross-cutting impact and dependency views — what a system touches, what a process depends on.
- Versioned views: select and view a specific published ontology version and see the change log /
  diff between versions (visualising the Constitution Engine's versioning).

**Structured (C4) view + embeddable canvas**

- One embeddable canvas component (modes `force | c4`) owned by the Explorer: the force-directed
  company graph AND a structured C4-style architecture view over the same graph.
- The Build Engine embeds a project-scoped slice of this canvas and writes project-architecture
  updates back through the Constitution Engine's validated operations.

**Async collaboration (MVP)**

- Team-shared, server-persisted saved views and canvas layout, scoped to the workspace.
- Asynchronous sharing of a view with colleagues, plus comments on nodes and views.

**Real-time collaboration — Phase 2 (not MVP)**

- Figma-style simultaneous multi-user exploration and editing with presence, cursors, and selections,
  built on a CRDT (Yjs); sync transport and scaling finalised at the Phase 2 tech spec. Deferred to
  Phase 2 because it is the costliest, identity- and hosting-dependent capability; the MVP delivers
  value without it.

**Visual editing**

- Create and edit nodes and relationships directly on the canvas, with every committed change
  validated by the Constitution Engine — a no-RDF visual editing surface that complements
  Constitution's natural-language and forms authoring. Editing operates on the Constitution Engine's
  mutable draft graph; published versions are read-only.

#### Out of Scope

- **The model, store, ontology, SHACL validation, and OWL reasoning** — owned by the Constitution
  Engine. The Explorer reads the graph and writes through validated operations; it does not own the
  model or the validation logic.
- **The versioning lifecycle engine** (draft → published, version identifiers, PROV-O change logs) —
  owned by the Constitution Engine; the Explorer visualises versions and diffs.
- **Raw SPARQL query authoring** — provided by the Constitution Engine; the Explorer offers visual
  navigation and exploration rather than a query console.
- **The automation flow canvas** — that is the Events & Actions Engine's automation-specific canvas,
  not the company network view.
- **Project-level kanban / PM graph views** — those belong to the Build Engine.

### Target Users

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Operations / business staff | Need to understand the operating model and find their part of it | A visual, navigable view of the model with no RDF or SPARQL knowledge required |
| Enterprise architect | Navigates, edits, and assesses the structure of the model | Drill-in views, impact/dependency visibility, and visual editing that stays validated |
| Workshop facilitator / Weave consultant | Runs client modelling sessions | MVP: team-shared saved views + async share/comments so a team builds a shared model; Phase 2: Figma-style real-time multi-user editing |
| Leadership / executive sponsor | Wants a high-level picture of how the company fits together | A whole-company view at a glance, with the ability to drill into areas of interest |
| Compliance / analyst | Reviews how things interconnect and how the model has changed | Dependency tracing and the ability to view specific versions and what changed between them |

### Success Criteria

- [ ] **The whole-company graph renders and navigates at real scale.** A real client graph renders as
  a force-directed network with usable drill-in, search, and filtering within acceptable interaction
  performance. Measured by a performance test against a realistic graph size; source: performance test
  results. Target: at GA.
- [ ] **Async collaboration works (MVP).** A user saves a team-shared view (including its server-side
  layout), shares it, and a colleague opens it and leaves a comment; the layout and comments are
  reproduced for the colleague. Measured by integration test; source: QA. Target: at GA.
- [ ] **Real-time collaboration works (Phase 2).** Multiple users (target: default 5 concurrent,
  tunable) explore and edit the same graph simultaneously with presence and cursors, and their edits
  converge with no lost updates. Measured by a multi-user load and convergence test; source: QA.
  Target: at Phase 2 GA.
- [ ] **Visual edits are always validated.** 100% of changes committed from the canvas pass through the
  Constitution Engine's SHACL validation, and an invalid visual edit is demonstrably blocked. Measured
  by integration test; source: QA. Target: at GA.
- [ ] **Non-experts can navigate.** A business-role user with no RDF/SPARQL knowledge completes a
  find-and-understand task through the visual surface. Measured by a usability test with a defined
  success rate; source: usability study. Target: 30 days after GA.
- [ ] **Versioned views work.** A user can view a specific published ontology version and a diff between
  two versions. Measured by functional test; source: QA. Target: at GA.
- [ ] **It runs a real modelling workshop.** At least one client modelling engagement is run on the
  Explorer (async share + saved views in MVP; live multi-user once Phase 2 ships). Measured by a
  completed engagement; source: engagement record. Target: within 6 months of GA.

### Constraints

**Technical**

- The Explorer is a module within the single modular React SPA (Next.js 15, TypeScript strict) — not a
  separate app.
- The Explorer owns and exposes an embeddable canvas component (modes `force | c4`) consumed by the
  Build Engine for its project-ontology view.
- Force-directed rendering must remain performant at realistic graph sizes; the rendering approach
  (Cytoscape.js reference prototype vs a WebGL renderer) and 10k-node performance are validated at the
  tech spec (an explicit open question, not a settled capability).
- Authoritative writes always go through the Constitution Engine's validated operations (`CE-WRITE-1`);
  the authorisation/validation boundary is server-side at that endpoint, never the canvas UI. The
  Explorer never writes unvalidated changes to the trusted graph.
- Saved views, layout, and comments are persisted server-side, scoped per tenant and workspace
  (multi-tenant isolation).
- (Phase 2) Real-time collaboration uses a CRDT (Yjs); the sync transport (e.g. WebSocket on Fargate)
  is finalised at the Phase 2 tech spec and must scale to the target concurrent-user count, with sync
  rooms tenant-scoped.

**Business**

- The MVP collaboration model is single-user editing plus asynchronous sharing (team-shared saved
  views + comments). Real-time, Figma-style multi-user collaboration is a **Phase 2** commitment, not
  a launch requirement (decision D1) — its engineering complexity is real and is sequenced after the
  MVP delivers value.

**Timeline / sequencing**

- The Explorer depends on the Constitution Engine (it reads and writes that graph) and is part of
  making the MVP usable — the formal model is not consumable by non-experts without it, so it is needed
  early rather than late.

### Navigation (Explorer secondary sidebar)

First-draft **secondary navigation** (left sidebar) for the **Explorer** primary area. The primary
top-header nav is defined in the `weave-platform` brief. The Explorer is canvas-centric, so the
sidebar is a set of panels over a persistent graph canvas rather than separate screens.

- **Explore (canvas)** — the default force-directed view of the company graph.
- **Saved views** — saved and shared focus/drill-in views (e.g. a domain, a process).
- **Filters & layers** — toggle entity types and relationship layers; search and filter.
- **Versions & diff** — view a specific published version and compare versions (visualising the
  Constitution Engine's versioning).
- **Share & comments** — share a saved view, see comments on nodes/views (MVP async collaboration).
  Live presence/participants (workshop mode) arrives in Phase 2.

> The canvas itself stays visible; selecting a sidebar panel changes what is overlaid or filtered, not
> the whole screen. Authoritative edits made on the canvas route through the Constitution Engine's
> validation.

<!-- SHARED-HOISTED: brief's platform-wide master decision list reference (CLAUDE.md § Architecture
decisions + weave-platform brief) is a pointer to ../weave-spec.md §Program, not restated here. -->

## 2. Product Requirements (PRD)

### Product Context

The Constitution Engine (CE) holds a formal OWL/SHACL knowledge graph of how a company operates. A
knowledge graph in Turtle is unreadable to the business and operations staff who actually need it. The
Graph Explorer is the visual surface that makes that graph accessible: a force-directed interactive
canvas where users explore, navigate, filter, overlay, and (for authorised roles) edit the operating
model — without understanding RDF or SPARQL.

The Explorer ships alongside the Constitution Engine as part of the MVP. Without a visual layer the CE
stays an expert-only tool and company-wide adoption stalls. Together they close the "model the
business" half of the Weave loop.

The Explorer does **not** own the model. Every authoritative change made on the canvas is written
through the CE's validated-operations write API (`CE-WRITE-1`), which SHACL-validates on a throwaway
clone and only commits if there are no `sh:Violation`s. The Explorer owns *how the graph is seen and
worked on*; the CE owns *what the graph is and whether it is valid*. The authoritative authorisation
boundary is the CE write endpoint (JWT + role claim) — the Explorer's edit-handle visibility is UX
convenience only, never the security control (see §2.2 Security).

The Explorer also **owns and provides** the embeddable canvas component `GE-CANVAS-1` (modes
`force` | `c4`). The Build Engine embeds a project-scoped slice of it and writes project architecture
back via `CE-WRITE-1` (E3 / GE-CANVAS-1).

**Grounded from the working prototype** (`weave-prototype/frontend`, citations inline):

- Cytoscape.js (prototype pins `^3.30.0`) with `cytoscape-fcose` is the primary force canvas library
  (`package.json`). The exact patch version is pinned by the architect at tech-spec.
- Spotlight selection (close neighbourhood full opacity, everything else dimmed), a semantic-zoom label
  threshold, drag-end position persistence to `localStorage` keyed by **projectId**
  (`CytoscapeGraph.tsx:18` `weave:layout:${projectId}`), `edgehandles` drag-connect with
  `hoverDelay:150`, `snap:false`, `preview:true`, self-loops blocked, edge-creation delegated upstream
  on `ehcomplete` (`CytoscapeGraph.tsx:188-205`), and an exact heatmap colour mapping
  (`CytoscapeGraph.tsx:43-51`) are proven patterns.
- The prototype differentiates node kinds by **colour only** (single ellipse shape,
  `cytoscape.ts:46-103`) and has a second React-Flow C4/"Model" canvas over the same graph; the
  Explorer now owns the C4 mode as part of GE-CANVAS-1 (E3).

**Decisions applied (digest IDs):** D1 (realtime → Phase 2; MVP single-user + async share/comments),
D2 (server-side team-shared Saved Views + layout), D3 (server diff of two published versions via
`CE-DIFF-1`, incl. edge modifications), E3 (Explorer owns `GE-CANVAS-1`, modes `force|c4`; Build embeds
project slice), E4 (every threshold = "default X, tunable").

**Goals**

1. Make the full company operating model visible and navigable to every role — no RDF or SPARQL
   required — reading from the CE versioned read interface (`CE-READ-1`).
2. Provide rich filtering and overlay (entity type, relationship type, heatmap, version diff, impact,
   domain colouring) so users focus on what matters.
3. Allow visual edits (add/edit/delete node, add edge) on the **draft** graph that commit safely through
   CE SHACL validation (`CE-WRITE-1`); published versions are read-only.
4. Provide team-shared, server-persisted Saved Views and layout (D2), plus **async sharing** of a view
   with comments (D1) — without realtime co-editing in the MVP.
5. Own and expose the embeddable `GE-CANVAS-1` canvas component (modes `force|c4`) consumed by the
   Build Engine for its project-ontology view (E3).
6. Visualise the CE's versioning: view any published version (read-only) and a server-computed diff
   between two published versions (`CE-DIFF-1`).

**Non-Goals**

- **The model, store, ontology, SHACL validation, OWL reasoning** — owned by the Constitution Engine.
- **The versioning lifecycle** (draft → published, version IRIs, PROV-O) — owned by the CE; the Explorer
  visualises it via `CE-READ-1` / `CE-VERSION-1` / `CE-DIFF-1`.
- **Raw SPARQL query authoring** — provided by the CE Query screen. The Explorer's property filter
  builder is a visual filter over the loaded graph, not a query console (FR-013, §2.2).
- **The automation flow canvas** — owned by the Events & Actions Engine.
- **Project-level kanban / PM graph views** — owned by the Build Engine. (Build embeds the `GE-CANVAS-1`
  slice for its project-ontology view, but owns its own PM surfaces.)
- **Realtime multi-user co-editing, presence, cursors, follow-me** — **Phase 2** (D1), not MVP.
- **WebGL rendering** (sigma.js, G6) — not in v1; a tech-spec escape hatch if 10k-node targets are not
  met (OQ-01).

**Personas & Roles**

| Persona | Description | Primary need | Permission level |
|---|---|---|---|
| Operations / business staff | Understand the operating model, find their part of it | Visual navigable view, no RDF/SPARQL | viewer (read-only canvas) |
| Enterprise architect | Navigates, edits, assesses structure | Drill-in, impact/dependency, validated visual editing | BA (instance edits) / ontologist (structure edits) |
| Workshop facilitator / Weave consultant | Runs modelling sessions; in MVP, async (live co-edit is Phase 2) | Saved Views, async share + comments | BA + view-pin (admin) |
| Leadership / exec sponsor | High-level picture of how the company fits | Whole-company view at a glance, drill-in | viewer |
| Compliance / analyst | Reviews interconnections and model history | Dependency tracing, version views, diff overlay | viewer |

> Role slugs are the CE RBAC vocabulary (`CE-WRITE-1` enforces them server-side): **ontologist** = may
> write structure (new node *kinds* / relationship *types*); **BA** = may write *instances*
> (add/edit/delete individual nodes/edges); **viewer** = read-only. Workspace **admin** is a Platform
> RBAC role (`PLAT-SETTINGS-1`) used for Saved-View pin/delete governance, not for graph writes.

### 2.1 Functional requirements

> "Phase / depends-on" ties each FR to a delivery phase and any engine/contract it cannot ship before.
> Every FR has a Given/When/Then AC + a failure-mode AC in §3 (Epics).

| ID | Requirement (observable behaviour + failure mode) | Story | Priority | Phase / depends-on |
|---|---|---|---|---|
| FR-001 | Cytoscape force canvas renders the draft graph via `CE-READ-1` with the documented fcose params (incl. `quality:'default'`, `randomize:true`); on CE error → retry empty-state, no partial render | E1-S1 | P0 | MVP, depends-on CE-READ-1 |
| FR-002 | Node colour by CE **BPMO kind** set + grey fallback (palette covers every BPMO kind, `Process` first-class/prominent; served by CE, client palette fallback); single ellipse shape v1; kind→shape mapping deferred (OQ-08) | E1-S1 | P0 | MVP, depends-on CE-READ-1 |
| FR-003 | Canvas load: default ≤ 3 s at 1k nodes / ≤ 8 s at 10k nodes (p95, desktop) — **unverified target pending OQ-01 benchmark**, tunable (AC in E1-S1 performance criterion) | E1-S1 | P0 | MVP, depends-on OQ-01 |
| FR-004 | Pan/zoom: scroll/pinch, Cmd+0 fit; mini-map bottom-right (net-new, `cytoscape-navigator`); binding collisions `preventDefault` only on canvas focus | E1-S2 | P0 | MVP |
| FR-005 | Semantic zoom: edge labels hide < default 0.55× (tunable), show on hover ≥ 0.55×; node labels above default 0.3× (tunable) | E1-S2 | P0 | MVP |
| FR-006 | Node click → spotlight (neighbourhood full, rest default 0.18 opacity tunable); side panel shows label/type/key props; **no raw IRI** for business users (advanced disclosure for ontologists) | E1-S3 | P0 | MVP, depends-on CE-READ-1 |
| FR-007 | Cmd+K / sidebar search on `rdfs:label`, `skos:prefLabel`, type label (net-new); click result → centre + spotlight; no global key capture | E1-S4 | P0 | MVP |
| FR-008 | Layout positions persisted **server-side** per (tenant, project, graphId) (D2); applied before fcose; "Reset layout" clears + re-runs; failed save → optimistic hold + retry, never dropped | E1-S5 | P0 | MVP |
| FR-009 | Right-click domain → "Focus domain" filters to members; empty domain → empty-state | E2-S1 | P0 | MVP, depends-on CE-READ-1 |
| FR-010 | Impact/dependency trace via CE SPARQL property-path SELECT (`CE-READ-1`); fixed predicate set (`dependsOn`, `realizes`, `servesGoal`; membership `inDomain`/`hasCapability` excluded; OQ-09); depth default-all/cap N default 6; off-canvas nodes auto-load or badge, never silently truncate | E2-S3 | P0 | MVP, depends-on CE-READ-1 |
| FR-011 | Entity-type toggles; off hides nodes+edges, layout re-flows; all-off → empty-state | E3-S1 | P0 | MVP |
| FR-012 | Relationship-type toggles (multi); orphaned nodes de-emphasised not removed | E3-S2 | P0 | MVP |
| FR-013 | Property filter builder (type+path+operator+value, AND, chips) — **client-side over loaded nodes only**, not a CE query; missing path → non-match | E3-S3 | P1 | MVP |
| FR-014 | Governed-content layer toggles (Glossary/Brand/Governance); empty layer toggle disabled | E3-S4 | P1 | MVP, depends-on CE-READ-1 |
| FR-015 | Heatmap overlay with **fixed prototype value→colour mappings** (maturity/investment/strategy/lifecycle, free-text fields); unmatched → grey + counted in legend | E4-S1 | P0 | MVP, depends-on CE-READ-1 |
| FR-016 | Diff overlay via **`CE-DIFF-1`** between two published versions; green/red(0.35)/amber incl. **edge modifications** (D3); identical → "no differences"; CE error → retry banner | E4-S2 | P0 | MVP, depends-on CE-DIFF-1 |
| FR-017 | Pinned impact overlay persists through pan/zoom; source-delete auto-clears | E4-S3 | P0 | MVP |
| FR-018 | Domain colouring layer (mutually exclusive with type colouring v1); palette overflow cycles with legend | E4-S4 | P1 | MVP, depends-on CE-READ-1 |
| FR-019 | Double-click → quick-add node via **`CE-WRITE-1`** (`add_node`, actor = editing user's Cognito identity); `422` shows SHACL violations; CE timeout → optimistic rollback | E5-S1 | P0 | MVP, depends-on CE-WRITE-1 |
| FR-020 | Edgehandles drag-connect (`hoverDelay:150, snap:false, preview:true`, self-loop blocked; **default handle styling**); edge op via `CE-WRITE-1`; timeout → rollback | E5-S2 | P0 | MVP, depends-on CE-WRITE-1 |
| FR-021 | Side-panel edit of label/comment/typed props via `CE-WRITE-1` (`update_node`); CE writes PROV-O + PLAT-AUDIT-1 stamp (actor = user Cognito identity); concurrent same-prop = LWW-with-version-check, else `409` notify | E5-S3 | P0 | MVP, depends-on CE-WRITE-1 |
| FR-022 | Delete node/edge via `CE-WRITE-1`: reference warning + confirm; **cascaded reification/annotation cleanup reflected on canvas** from CE response; failure → nothing removed | E5-S4 | P0 | MVP, depends-on CE-WRITE-1 |
| FR-023 | Async share of a Saved View → recipient notified via **`PLAT-NOTIFY-1`**; recipients lacking access excluded (no leak) | E6-S1 | P0 | MVP, depends-on PLAT-NOTIFY-1 |
| FR-024 | Comments on node/view persisted server-side (Explorer Aurora, tenant+workspace scoped); failed write → draft preserved + retry | E6-S2 | P0 | MVP |
| FR-025 | Live refresh via **`CE-EVENT-1`**; degrade to polling `CE-READ-1` (since-version, default 30 s tunable) when stream unavailable | E6-S3 | P1 | MVP (poll) / live when CE-EVENT-1 ships |
| FR-026 | Realtime co-edit + presence/cursors (Yjs, default 5 concurrent / ≤500 ms p95, tunable); CRDT room id includes tenant id, JWT tenant validated at connect | E6-S4 | Won't (MVP) / Must (P2) | **Phase 2**, depends-on OQ-02 |
| FR-027 | Workshop "Follow me" (viewport-only sync) | E6-S5 | Won't (MVP) / Should (P2) | **Phase 2**, depends-on OQ-07 |
| FR-028 | Save view (filters, overlays, domain focus, viewport, **server-side layout** D2); name required; name collision → overwrite/rename prompt | E7-S1 | P0 | MVP |
| FR-029 | Workspace-shared view library; creator deletes own, workspace admin (`PLAT-SETTINGS-1`) deletes any; missing entities flagged | E7-S2 | P0 | MVP, depends-on PLAT-SETTINGS-1 |
| FR-030 | Featured pinned views (default 5 tunable, admin-pinned); limit → unpin prompt | E7-S3 | P1 | MVP, depends-on PLAT-SETTINGS-1 |
| FR-031 | Versions panel lists versions via **`CE-VERSION-1`**; select loads via `CE-READ-1` read-only; default canvas = **draft**, `latest` = newest published (B2) | E8-S1 | P0 | MVP, depends-on CE-VERSION-1, CE-READ-1 |
| FR-032 | Version compare applies `CE-DIFF-1` diff overlay; JSON summary export (PDF/CSV → OQ-06) | E8-S2 | P0 | MVP, depends-on CE-DIFF-1 |
| FR-033 | Expand/collapse neighbours; expansion > default 500 (tunable) → confirm | E2-S2 | P1 | MVP, depends-on CE-READ-1 |
| FR-034 | Provide **`GE-CANVAS-1`** embeddable component (props `source, filterByIri, mode:force\|c4, readonly, version`); Build embeds project slice, writes back via `CE-WRITE-1`; empty filter → empty-state | E9-S1 | P0 | MVP (force + c4), provides GE-CANVAS-1 |

### 2.2 Non-functional requirements

**Performance**

- Canvas initial load: **default ≤ 3 s at 1k nodes, ≤ 8 s at 10k nodes** (p95, desktop Chrome/Safari,
  modern hardware). These are **unverified targets pending the OQ-01 benchmark** — not
  prototype-proven; tunable.
- Node drag: **default ≤ 16 ms (60 fps)** at ≤ 1,000 visible nodes (single-user); tunable target.
- Filter/overlay apply: **default ≤ 300 ms** at up to 10k nodes; tunable target.
- (Phase 2) Collaborative cursor sync: **default ≤ 500 ms p95** at default 5 concurrent users; tunable.
- fps/latency targets are a single tiered table validated by the OQ-01 harness (browser, hardware,
  node/edge count, fps sampling method all defined there); the 60 fps@1k and any @5k figures are tiers
  of one model, not conflicting claims.

**Scalability**

- v1 target: up to **default 10,000 nodes / 30,000 edges** (tunable) with Cytoscape + fcose. Viewport
  culling and lazy loading are **required net-new capabilities the architect must design and
  benchmark** (no prototype implementation), gated to OQ-01; a WebGL renderer (sigma.js/G6) is the
  escape hatch if Cytoscape cannot meet targets (OQ-05).

**Security**

- All CE calls require a Cognito JWT. The **authoritative edit-authorisation boundary is `CE-WRITE-1`
  server-side (JWT + CE role claim)** — the Explorer's edit-handle visibility is UX only and is never
  the security control. Role mapping: **ontologist** writes structure (node kinds / relationship
  types), **BA** writes instances, **viewer** is read-only.
- Historical published-version views are always read-only; the edit UI is disabled.
- Secrets (e.g. any sync-server credentials in Phase 2) live in **AWS Secrets Manager only** — never in
  `.env` or source.
- (Phase 2) CRDT sync-room id includes the tenant id; the sync server validates the JWT tenant claim
  against the room on connect and rejects a mismatch.
- Input validation at boundaries: filter values, comment text, and view names are sanitised
  client-side and re-validated server-side (Explorer Aurora writes use parameterised queries; no string
  concatenation into SQL — project security rule).

**Reliability**

- Edit flows are optimistic with rollback on `CE-WRITE-1` error/timeout (default 10 s, tunable):
  add/edge/delete never leave an orphan or a phantom-removed element on canvas.
- Live refresh degrades from `CE-EVENT-1` stream to polling `CE-READ-1` (default 30 s) without blocking
  the user.
- Layout/view/comment writes retry with backoff; never silently dropped.

**Observability**

- OTel spans for: graph load (`ce.read` attrs `version`, `node_count`), edit commit (`ce.write` attrs
  `op_type`, `result`, `actor_principal`), diff (`ce.diff` attrs `from`, `to`), traversal
  (`ce.sparql.path` attrs `depth`, `hops`). Errors correlate by request id; the `PLAT-AUDIT-1` `seq`
  of each committed edit is logged for cross-reference.

**Accessibility**

- Side panel, search overlay, filter sidebar, comments: **WCAG 2.1 AA**, keyboard-navigable,
  ARIA-labelled.
- Canvas interactions (pan/zoom/spotlight) have keyboard equivalents and are screen-reader labelled;
  the force canvas need not be fully SR-navigable in v1 but must not trap keyboard focus.
- The accessibility gate is **zero axe-core violations** on the non-canvas UI in CI.

**Isolation & data safety**

- **Multi-tenant isolation mechanism:** all CE reads/writes are tenant-scoped via the CE's named-graph
  + query-rewriting that **rejects any unscoped query** (resolve-by-default; final store-per-tenant vs
  named-graph mechanism is a CE/Platform tech-spec OQ but the expectation and test are stated here).
  Explorer-owned Aurora tables (views, layout, comments) carry a `tenant_id` + `workspace_id` on every
  row, filtered by the resolved `PLAT-SETTINGS-1` scope.
- **Cross-tenant-read test (required):** Given a tenant-A JWT, when any Explorer read (graph load, Saved
  View list, comment fetch, diff) is issued, then **zero tenant-B rows/triples** are returned; an
  attempt to address a tenant-B view id or room (Phase 2) is rejected.

**Browser / device support**

- Chrome, Firefox, Safari — latest 2 major versions. Desktop-first; no mobile/tablet optimisation in v1.

### 2.3 Inter-engine interfaces

> Reference contracts by ID from `../contracts.md`. Consumed contracts are version-pinned (downstream
> auto-tracks `latest` unless pinned — B2/CE-VERSION-1). Full contract definitions live in
> `../contracts.md`; only ID + intent is cited here.

**Consumed (this engine calls / reads)**

| Provider engine | Contract | Version pin | Used for |
|---|---|---|---|
| Constitution Engine | `CE-READ-1` (`/api/ontology/types\|resource\|versions`, `/api/sparql` SELECT-only/paginated, `/api/node-kinds`) | `latest` (per-view pin for E8 historical) | Load graph, node-kinds palette, spotlight props, impact property-path traversal, version-graph load |
| Constitution Engine | `CE-WRITE-1` (`POST /api/operations/apply`) | `target:"draft"` | All authoritative node/edge add/update/delete (E5); Build-embedded canvas write-back; server-side authz boundary |
| Constitution Engine | `CE-DIFF-1` (`/api/ontology/diff?from&to`) | published version IRIs | Server-computed diff (added/removed/modified nodes **and edges**) for the diff overlay (E4-S2/E8-S2) |
| Constitution Engine | `CE-VERSION-1` (`/api/ontology/versions`, canonical lag) | n/a | Version list + "latest" + version-lag for the Versions panel (E8-S1) |
| Constitution Engine | `CE-EVENT-1` (graph-change stream) | n/a | Live in-place refresh (Should Have; degrade to poll `CE-READ-1`) (E6-S3) |
| Platform | `PLAT-NOTIFY-1` (notification service) | n/a | "View shared with you" notifications (E6-S1) |
| Platform | `PLAT-SETTINGS-1` (tenancy/RBAC cascade) | n/a | Workspace-admin role for Saved-View pin/delete governance; tenant scoping of views/comments/layout |
| Platform | `PLAT-IDENTITY-1` (agent/principal registry) | n/a | Actor principal IRI for **agent-initiated** writes only (e.g. an automation/embed); human edits use the editing user's Cognito identity as the `CE-WRITE-1` actor (OQ-11) |
| Platform | `PLAT-AUDIT-1` (immutable audit log) | n/a | Read-only: correlate an edit's audit `seq` for observability/log cross-reference. The CE writes the audit entry on apply; the Explorer does not emit to it directly |

**Provided (this engine exposes to others)**

| Contract | Consumers | Shape (link) | Stability |
|---|---|---|---|
| `GE-CANVAS-1` — embeddable canvas component, props `{ source, filterByIri, mode:"force"\|"c4", readonly, version }` | Build Engine (embeds project-scoped slice; writes back via `CE-WRITE-1`) | `../contracts.md` (GE-CANVAS-1) | beta (force MVP; c4 MVP) |

> Saved Views, server-side layout positions, and comments are **Explorer-internal** (Aurora tables,
> tenant/workspace-scoped). They are intentionally NOT inter-engine contracts and carry no contract ID.

### 2.4 Open questions

| # | Question | Owner |
|---|---|---|
| OQ-01 | Cytoscape + fcose performance at 10k nodes: can it meet the (default, tunable) 8 s load / 60 fps drag targets? Define the benchmark harness (browser, hardware, node/edge count, fps sampling). | Architect |
| OQ-02 | (Phase 2) Yjs sync transport + scaling: WebSocket on single Fargate vs distributed (y-redis); concurrent-session scaling. | Architect |
| OQ-03 | Whole-version graph retrieval above one page: dedicated CE bulk/CONSTRUCT export endpoint vs paginated `CE-READ-1` SELECT at scale. File as cross-engine dependency on CE. | CE / Architect |
| OQ-04 | Viewport culling + lazy-loading design + benchmark (net-new; no prototype). Tied to OQ-01. | Architect |
| OQ-05 | Large-graph escape hatch if 10k target unmet by Cytoscape: sigma.js / G6 / WebGL canvas. | Architect |
| OQ-06 | Diff/version export format beyond JSON (PDF/CSV) and whether export is a CE-owned report endpoint. | Architect + Compliance stakeholder |
| OQ-07 | (Phase 2) "Follow me" transport: shared Yjs connection vs separate lightweight broadcast channel. | Architect |
| OQ-08 | Styled edge-handle (colour/size) and a kind→shape / relationship-type→stroke visual mapping (net-new design beyond colour-only prototype). | PO + Design |
| OQ-09 | Exact closure of "depends-on" predicates for impact traversal across the shipped BPMO relationship types (does `realizes`/`servesGoal` direction hold?). | Architect + CE |
| OQ-10 | ODRL policy enforcement is **not** in the v1 stack; PII/sensitive handling uses SHACL + data-classification properties. Whether any Explorer overlay must surface data-classification is deferred. | Architect |
| OQ-11 | Whether a human-initiated `CE-WRITE-1` edit should also be attributed to a `PLAT-IDENTITY-1`-minted principal IRI (vs the raw Cognito identity) in PROV-O / audit. | Architect + Platform |

### 2.5 Key design decisions captured

**Brief-level key decisions (Explorer-specific)**

For the platform-wide master list see `../weave-spec.md §Program` (CLAUDE.md § Architecture decisions
+ the `weave-platform` brief). Decisions specific to the Graph Explorer:

| Decision | Rationale | Date |
|----------|-----------|------|
| Graph Explorer owns the visual canvas (incl. the embeddable `force\|c4` component) and collaboration UX; the Constitution Engine owns the model, store, and validation | Clean separation: how the graph is seen and manipulated vs what the graph is and what is valid | 2026-06-26 |
| MVP collaboration = single-user editing + async share (team-shared saved views + comments); real-time multi-user is **Phase 2** (D1) | The strongest prototype evidence sequences live collab as the costliest, identity/hosting-dependent capability; the MVP delivers value without it | 2026-06-30 |
| Real-time collaboration (Phase 2) uses a CRDT (Yjs) | Mature, open, portable, self-hostable on AWS; no per-seat SaaS lock-in; manages concurrent canvas/presence state | 2026-06-26 |
| Authoritative writes flow through Constitution's `CE-WRITE-1` SHACL validation; authz is server-side at that endpoint | Visual editing must never produce an invalid or untrusted model; the canvas UI is never the security boundary | 2026-06-30 |
| The Explorer owns the embeddable canvas component (modes `force\|c4`); Build embeds a project-scoped slice (D3/E3) | Two views over one graph; reuse rather than rebuilding a viewer in Build | 2026-06-30 |
| Saved views + layout + comments are server-side, team-shared, Explorer-owned (D2) | The value of named views is a shared team library; per-browser layout cannot be shared | 2026-06-30 |
| The Explorer is a module within the single React SPA | Consistent with the platform's single-modular-SPA decision (no micro-frontends) | 2026-06-24 |
| The Explorer visualises versioned ontology/glossary/graph and a server-computed diff (`CE-DIFF-1`) | Lets users view specific published versions and changes incl. edge modifications; the versioning lifecycle is owned by the Constitution Engine | 2026-06-30 |
| Needed early as part of MVP usability | The formal Constitution model is not consumable by non-experts without a visual surface | 2026-06-26 |
| Rendering approach (Cytoscape.js vs WebGL renderer) and 10k-node performance deferred to tech spec | A performance/scale decision better made with concrete graph-size targets; not a settled capability | 2026-06-26 |

**PRD-level key design decisions captured**

| Decision | Rationale |
|---|---|
| Realtime collaboration is **Phase 2**; MVP = single-user editing + async share + comments (D1) | The strongest prototype evidence sequences realtime multi-party collab as the costliest, identity/hosting-dependent capability (`contribution-model.md`). MVP value lands without it. |
| Cytoscape.js (prototype `^3.30.0`; patch pinned at tech spec) + fcose for v1 force mode; 10k-node performance is a **target to validate (OQ-01)**, WebGL escape hatch (OQ-05) | Proven force patterns in prototype; 10k+culling is unproven and must not be asserted as settled. |
| All authoritative writes go through **`CE-WRITE-1`** (`POST /api/operations/apply`); legacy `/api/llm/mutate` not used | The CE's sole validated mutation entry point (SHACL on throwaway clone, PROV-O attribution); replaces the previously-"invented" endpoint wording (cross-spec seam). |
| Server diff via **`CE-DIFF-1`**, incl. **edge modifications** (D3) | Server-side diff between two published versions; supersedes the prototype's client-side live-vs-snapshot diff that never marked edges modified. |
| Saved Views, layout, comments are **server-side, team-shared, Explorer-owned Aurora** (D2) | Resolves the per-browser-localStorage vs team-shared contradiction; positions for a shared view are persisted with the view. Not graph data → no inter-engine contract. |
| Explorer **owns `GE-CANVAS-1`** (modes `force\|c4`); Build embeds the project slice (E3) | Resolves the dual-canvas scope gap; the C4/structured canvas is IN and owned here; Build reuses rather than rebuilding (cross-spec seam). |
| Edit authz is **server-side at `CE-WRITE-1`**; canvas handle-hiding is UX only; CE role slugs (ontologist/BA/viewer) | Client gating is not a security control; aligns role vocabulary to CE. |
| Heatmap uses the **fixed prototype value→colour mappings**; EA dimension fields are free-text strings | Removes the unfalsifiable "auto-derived" scheme; matches the data model. |
| Default editable target = **draft** graph; published versions read-only; `latest` = newest published (B2) | You cannot edit an immutable published version; disambiguates load target vs edit target. |
| Raw IRI hidden from business-user side panel (advanced disclosure for ontologists) | Upholds the model-hiding contract that is the product's reason to exist. |
| Property filter builder is **client-side visual filtering**, not a query | Keeps the CE Query screen as the sole query-authoring surface. |

### 2.6 PRD-level acceptance criteria

The Graph Explorer PRD is satisfied when:

- [ ] A non-technical business user (viewer role) opens the Explorer and finds + spotlights a named
  entity without writing SPARQL or seeing a raw IRI.
- [ ] A BA-role user creates a node by double-click; an invalid creation returns a `422` from
  `CE-WRITE-1` and is shown as a human-readable SHACL violation; a `CE-WRITE-1` timeout rolls the
  optimistic node back with no orphan.
- [ ] The diff overlay shows the correct added/removed/**modified (incl. edges)** elements between two
  published versions via `CE-DIFF-1`.
- [ ] A Saved View capturing a domain filter + heatmap + **server-side layout** is saved, shared via
  `PLAT-NOTIFY-1`, and reopened by a different workspace user with the same layout.
- [ ] A compliance analyst views the graph in a specific historical published version, read-only.
- [ ] The Build Engine embeds `GE-CANVAS-1` scoped to a project IRI in both `force` and `c4` modes and
  writes a project-architecture change back via `CE-WRITE-1`.
- [ ] Cross-tenant isolation test passes: a tenant-A JWT returns zero tenant-B rows/triples across graph
  load, Saved Views, comments, and diff.
- [ ] At the (unverified, OQ-01) 5,000-node tier, the canvas loads within the agreed target and stays
  interactive at the agreed fps — or OQ-01 has triggered the WebGL escape hatch (OQ-05).

### 2.7 Risks & mitigations

> Source risks carry no R-IDs; preserved verbatim and referenced by topic.

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Cytoscape cannot hit 10k-node targets | High | Med | OQ-01 benchmark early; WebGL escape hatch (OQ-05); culling/lazy-load (OQ-04) |
| Realtime collab (Phase 2) underestimated | High | Med | D1 defers it out of MVP; cost warning surfaced; budget at Phase 2 tech spec |
| `CE-WRITE-1` / `CE-DIFF-1` shapes shift during CE tech spec | Med | Med | Contracts are version-stable IDs; consume by ID, pin versions; integration tests against CE stubs |
| Server-side layout/views scope (D2) adds net-new Aurora schema not in prototype | Med | High | Explorer-owned table; tenant/workspace scoped; covered by isolation test |
| C4 mode (E3/GE-CANVAS-1) is net-new (prototype React-Flow canvas not productionised) | Med | High | Own epic (E9); architect budgets c4 mode distinctly from force mode |
| Impact traversal predicate semantics wrong (OQ-09) | Med | Med | Fix predicate closure with CE before build; testable example graph in AC |

## 3. Epics

> Each epic below merges the PRD §3 user stories (with full Given/When/Then + failure-mode ACs) and the
> EPIC-NNN file's epic-level acceptance criteria, dependencies, and technical notes.

### EPIC-001 — Whole-Company Canvas (force mode)

**Phase:** Phase 1 (MVP) · **Priority:** Must Have · **MVP:** yes · **Provides:** — ·
**Consumes:** CE-READ-1 · **Depends on:** CE-READ-1 · **Blocks:** EPIC-002, EPIC-008 (and EPIC-003,
EPIC-005, EPIC-009 per technical notes)

Delivers the foundational force-directed canvas: the draft graph loads via `CE-READ-1`, nodes are
coloured by CE node-kind, and users pan, zoom, spotlight, and search without RDF or SPARQL. It is the
first surface every other Explorer epic builds on, and the visualise half of the MVP thin loop.

**User stories**

| Task ID | Title | Priority |
|---------|-------|----------|
| E1-S1 | View the whole company graph on load | Must Have |
| E1-S2 | Pan, zoom, navigate | Must Have |
| E1-S3 | Spotlight a node | Must Have |
| E1-S4 | Search for a node by name or type | Must Have |
| E1-S5 | Persist and reset layout (server-side, D2) | Must Have |

**E1-S1: View the whole company graph on load**
As any user, I want to open the Explorer and see the company's operating model as a force-directed
network so that I immediately grasp the whole business, not a list of records.

- **AC:** Given an authenticated user, when the Explorer opens, then nodes and edges of the **current
  draft** graph (default editable target — published versions are read-only, see E8) load via
  `CE-READ-1` and render in the Cytoscape canvas with fcose params `animate:true,
  animationDuration:600ms, nodeSeparation:90, idealEdgeLength:110, nodeRepulsion:6500,
  quality:'default', randomize:true` (`cytoscape.ts:105-114`; randomize/auto-layout runs only for nodes
  lacking saved positions).
- **AC:** Given the loaded graph, when rendered, then each node is coloured by its CE node-kind using
  the **BPMO framework** kind set + grey fallback served by CE (`/api/node-kinds` via `CE-READ-1`;
  client palette is fallback only). The palette **must cover every BPMO kind** with a grey fallback for
  any unrecognised/client-extension kind. `Process` is a first-class visible kind and takes a prominent
  hue. Reference palette: Process `#dc2626`, Activity `#f59e0b`, Event `#0ea5e9`, Actor `#0d9488`,
  Goal `#ca8a04`, Policy `#be185d`, BusinessDomain `#7c3aed`, BusinessCapability `#db2777`,
  System `#2563eb`, Service `#0891b2`, DataAsset `#16a34a`, Concept `#ea580c`, Field `#65a30d`,
  Class `#d97706`, fallback `#64748b`. Node **shape** is a single ellipse in v1 (prototype is
  colour-only, `cytoscape.ts:46-103`); a kind→shape and relationship-type→stroke mapping is a net-new
  design decision deferred to OQ-08.
- **AC (failure mode):** Given `CE-READ-1` returns an error or times out (default 10 s, tunable per
  workspace), when the canvas tries to load, then an empty-state with a retry action and the CE error
  message is shown; no partial/half-rendered graph is left on screen.
- **AC (performance, FR-003):** Given a draft graph on the OQ-01 reference hardware/profile, when the
  Explorer loads, then first interactive render completes within the default targets ≤ 3 s at 1k nodes
  and ≤ 8 s at 10k nodes (p95) — **unverified pending the OQ-01 benchmark**, tunable per workspace.
- **Priority:** Must Have

**E1-S2: Pan, zoom, navigate**
As any user, I want to pan/zoom with mouse, trackpad, and keyboard so I move around large graphs
without losing orientation.

- **AC:** Given the canvas, when the user scrolls/pinches, then the canvas zooms; when the user presses
  Cmd/Ctrl+0, then the canvas fits-to-screen.
- **AC:** Given semantic zoom (label threshold **default 0.55×, tunable per workspace**), when zoom
  < 0.55×, then edge labels hide; when ≥ 0.55×, edge labels show on hover; node labels show above
  **default 0.3×, tunable per workspace**.
- **AC:** Given the canvas, when rendered, then a mini-map (fixed bottom-right) shows viewport position
  relative to the full graph. The mini-map is **net-new** (no prototype) — built with
  `cytoscape-navigator` (or equivalent) named at tech spec.
- **AC (failure mode):** Given a Cmd+0 / Cmd+K binding collides with a browser shortcut, when pressed,
  then the canvas handler `preventDefault`s only when the canvas has focus; otherwise the browser
  default wins (no silent capture).
- **Priority:** Must Have

**E1-S3: Spotlight a node**
As any user, I want to click a node and see it and its neighbours highlighted while everything else dims
so I understand one entity's connections without noise.

- **AC:** Given a node, when clicked, then `closedNeighborhood` stays at full opacity and all other
  elements dim to **default 0.18 opacity, tunable per workspace** (prototype value).
- **AC:** Given a node is spotlighted, when the side panel opens, then it shows label, human-readable
  type (kind), and key property values from the CE. The raw **IRI is NOT shown** in the default
  business-user panel (model-hiding contract); it is revealed only under an "Advanced / technical
  details" disclosure for ontologist-role users.
- **AC (failure mode):** Given background click or Escape, when pressed, then the spotlight clears and
  full opacity restores; if the side-panel property fetch fails, the panel shows label + type from the
  already-loaded element and a "details unavailable" notice rather than blanking.
- **Priority:** Must Have

**E1-S4: Search for a node by name or type (net-new)**
As any user, I want to search the canvas by label or type so I find a specific node without scanning.

- **AC:** Given the canvas, when the user presses Cmd/Ctrl+K (or focuses the sidebar search), then a
  search overlay opens and filters: matching nodes highlight, non-matching dim. Matching is on
  `rdfs:label`, `skos:prefLabel`, and entity-type label.
- **AC:** Given results, when a result is clicked, then the canvas centres and spotlights that node.
- **AC (failure mode):** Given Cmd+K is reserved by the browser/OS, when the canvas lacks focus, then the
  binding does not fire (no global capture); the sidebar search field remains the fallback entry.
- **Priority:** Must Have

**E1-S5: Persist and reset layout (server-side, D2)**
As any user, I want node positions saved after I drag them and restored next visit so I don't re-arrange
every session.

- **AC:** Given a node is dragged, when drag ends, then its position is persisted **server-side**, scoped
  per **(tenant, project, graphId)** — replacing the prototype's per-browser `localStorage` key
  `weave:layout:${projectId}` (`CytoscapeGraph.tsx:18`). The store is an Explorer-owned Aurora table
  (not graph data; not an inter-engine contract). `localStorage` is a client cache only.
- **AC:** Given saved positions exist, when the canvas loads, then they are applied before fcose runs;
  fcose runs only for nodes lacking a saved position or when "Reset layout" is clicked.
- **AC (failure mode):** Given the layout-persistence API is unreachable on drag-end, when the write
  fails, then the position holds optimistically on canvas, a "layout not saved" toast appears, and the
  client retries with backoff; positions are never silently dropped.
- **Priority:** Must Have

**Epic-level acceptance criteria**

- [ ] Saved server-side layout positions (E1-S5) are applied to nodes **before** the fcose auto-layout
  (E1-S1) runs; fcose randomise/auto-layout executes only for nodes that lack a saved position or after
  an explicit "Reset layout".
- [ ] Across load, spotlight (E1-S3), and search (E1-S4), no raw IRI is ever shown to a viewer/business
  role — the business-user side panel surfaces label, human-readable kind, and key props only; IRIs
  appear solely under the ontologist "Advanced / technical details" disclosure.
- [ ] Every keyboard binding introduced here (Cmd+0 fit, Cmd+K search) `preventDefault`s only when the
  canvas has focus — no binding silently captures a browser/OS shortcut when the canvas is unfocused.
- [ ] A tenant-A JWT loading the graph returns **zero tenant-B nodes/edges** (cross-tenant isolation,
  §2.2); layout positions are scoped per (tenant, project, graphId) and never leak across tenants.
- [ ] On a `CE-READ-1` error or timeout (default 10 s, tunable), the canvas shows a retryable empty-state
  with the CE error message and leaves no partial/half-rendered graph on screen.

**Dependencies**

- **Blocked by:** Constitution Engine `CE-READ-1` (graph + `/api/node-kinds` load); Platform
  `PLAT-SETTINGS-1` (tenant/workspace scoping of layout). Explorer-owned Aurora layout table (internal).
- **Blocks:** EPIC-002, EPIC-003, EPIC-005, EPIC-008 (all render on / extend this canvas) and the
  EPIC-009 `GE-CANVAS-1` component, which reuses this canvas.

**Technical notes**

- Cytoscape.js (`^3.30.0`, patch pinned at tech spec) + `cytoscape-fcose`; documented fcose params
  (`nodeSeparation:90`, `idealEdgeLength:110`, `nodeRepulsion:6500`, `quality:'default'`,
  `randomize:true`). Node colour palette served by CE (the **BPMO framework** kind set + grey fallback;
  palette covers every BPMO kind, `Process` first-class/prominent); client palette is fallback only.
- Node **shape** is a single ellipse in v1; a kind→shape / relationship-type→stroke mapping is deferred
  to **OQ-08**, not asserted here.
- The mini-map (E1-S2) is net-new (`cytoscape-navigator` or equivalent, named at tech spec); semantic
  zoom thresholds (label 0.55×, node 0.3×, dim 0.18) are "default X, tunable per workspace".
- The ≤ 3 s @ 1k / ≤ 8 s @ 10k load targets (FR-003) are **unverified pending the OQ-01 benchmark** —
  treat as tunable targets, not settled facts. Viewport culling / lazy load is net-new (OQ-04).

### EPIC-002 — Drill-In & Domain Focus

**Phase:** Phase 1 (MVP) · **Priority:** Must Have · **MVP flag:** false · **Provides:** — ·
**Consumes:** CE-READ-1 · **Depends on:** EPIC-001, CE-READ-1 · **Blocks:** EPIC-003, EPIC-005

Lets users narrow a large graph to what matters: focus a single business domain, reveal a node's
neighbourhood one hop at a time, and trace upstream/downstream impact via a CE SPARQL property-path
query. Together these turn the whole-company canvas from an overview into an investigation surface.

**User stories**

| Task ID | Title | Priority |
|---------|-------|----------|
| E2-S1 | Drill into a domain | Must Have |
| E2-S2 | Expand/collapse a node's neighbourhood | Should Have |
| E2-S3 | Impact / dependency trace | Must Have |

**E2-S1: Drill into a domain**
As any user, I want to focus a domain so the canvas shows only its members and their relationships.

- **AC:** Given a `BusinessDomain` node, when right-click → "Focus domain", then the canvas filters to
  its members + relationships; others hide; a breadcrumb / "back to full graph" restores the view.
- **AC:** Given a focused domain, when saved, then it can be captured as a Saved View (E7).
- **AC (failure mode):** Given a domain with zero members, when focused, then a "no members in this
  domain" empty-state shows with a one-click return to full graph.
- **Priority:** Must Have

**E2-S2: Expand/collapse a node's neighbourhood**
As an enterprise architect, I want to reveal a node's neighbours one hop at a time for dense graphs.

- **AC:** Given a node, when right-click → "Expand neighbours", then its first-degree neighbours are
  added to the visible set; already-visible nodes are not duplicated; "Collapse" hides them.
- **AC (failure mode):** Given expansion would add > a configurable cap (**default 500 nodes, tunable per
  workspace**), when triggered, then a confirmation warns of the count before expanding.
- **Priority:** Should Have

**E2-S3: Impact / dependency trace**
As any user, I want to select a node and see everything upstream/downstream highlighted so I understand
cross-domain impact before changing anything.

- **AC:** Given a node, when right-click → "Show impact" (downstream) or "Show dependencies" (upstream),
  then traversal highlights the full chain. **Traversal direction predicates are fixed:** `dependsOn`
  (a depends on b ⇒ b is upstream of a); `realizes` and `servesGoal` count as upstream contributors;
  `inDomain`/`hasCapability` refs are membership, not dependency, and do NOT traverse. The exact closure
  of "depends-on" predicates is confirmed against the shipped BPMO relationship types and recorded as
  OQ-09.
- **AC:** Given traversal, when run, then it executes as a **CE SPARQL property-path SELECT** via
  `CE-READ-1` (paginated, SELECT-only, SERVICE blocked, no silent row cap — B3), with depth **default =
  all reachable, tunable, cap N hops (default 6)**. Highlight colour is a distinct amber overlay,
  separate from spotlight blue.
- **AC (failure mode):** Given the chain references nodes not currently loaded on canvas, when
  highlighted, then those nodes are auto-loaded (or a "N off-canvas dependencies" badge is shown if
  auto-load is capped); the trace never silently truncates without indicating it.
- **Priority:** Must Have

**Epic-level acceptance criteria**

- [ ] Every drill-in operation (domain focus, expand, impact trace) is reversible: a breadcrumb / "back
  to full graph" or collapse restores the prior visible set, and no operation strands the user in a view
  they cannot exit.
- [ ] Impact/dependency traversal (E2-S3) runs as a CE SPARQL property-path SELECT via `CE-READ-1`
  (paginated, SELECT-only, SERVICE blocked, no silent row cap); it never silently truncates — a chain
  referencing off-canvas nodes either auto-loads them or shows an "N off-canvas dependencies" badge.
- [ ] Traversal uses only the fixed depends-on predicate closure (`dependsOn`, `realizes`, `servesGoal`);
  membership refs (`inDomain`/`hasCapability`) do not traverse — the exact closure is confirmed against
  the shipped BPMO relationship types (OQ-09) before build.
- [ ] Any operation that could explode the visible set (expand > default 500 nodes, tunable) warns with a
  count and requires confirmation before applying — no unbounded expansion.
- [ ] Empty/zero-result paths (a domain with no members) render an explicit empty-state with one-click
  return, never a blank canvas.

**Dependencies**

- **Blocked by:** EPIC-001 (focus/expand/trace operate on the loaded canvas); Constitution Engine
  `CE-READ-1` (domain membership load + SPARQL property-path traversal).
- **Blocks:** EPIC-004 — the pinned impact overlay (E4-S3) consumes the E2-S3 trace; EPIC-005 sequences
  after this epic in the roadmap.

**Technical notes**

- Impact highlight uses a distinct amber overlay, separate from spotlight blue (EPIC-001), so the two
  highlight modes never visually collide. Depth is "default = all reachable, tunable, cap N hops
  (default 6)".
- The depends-on predicate closure is an **open question (OQ-09)** to resolve with the CE against the
  shipped BPMO relationship types; do not hard-code an unverified direction for `realizes` / `servesGoal`.
- A focused domain must be capturable as a Saved View (EPIC-007) — keep focus state serialisable.

### EPIC-003 — Filters & Layers

**Phase:** Phase 1 (MVP) · **Priority:** Must / Should Have · **MVP flag:** false · **Provides:** — ·
**Consumes:** CE-READ-1 · **Depends on:** EPIC-002, CE-READ-1 · **Blocks:** EPIC-004

Provides the Filters & Layers panel so users reduce visual noise: toggle entity types and relationship
types on/off, apply a client-side property filter over the loaded nodes, and show/hide governed-content
layers. All filtering is visual over the already-loaded graph — it never issues a server query and never
overlaps the CE Query screen.

**User stories**

| Task ID | Title | Priority |
|---------|-------|----------|
| E3-S1 | Toggle entity types on/off | Must Have |
| E3-S2 | Toggle relationship types on/off | Must Have |
| E3-S3 | Filter by property value (visual filter, NOT a query) | Should Have |
| E3-S4 | Show/hide governed content layers | Should Have |

**E3-S1: Toggle entity types on/off**

- **AC:** Given the Filters & Layers panel, when it opens, then it lists all entity types present with
  toggles; toggling off hides those nodes + edges and the layout re-flows; toggling on restores them with
  positions preserved.
- **AC (failure mode):** Given all types are toggled off, when applied, then an empty-canvas state with
  "all types hidden — re-enable a type" is shown (no blank confusion).
- **Priority:** Must Have

**E3-S2: Toggle relationship types on/off**

- **AC:** Given the panel, when relationship-type toggles are used, then matching edges show/hide;
  multiple types toggle simultaneously.
- **AC (failure mode):** Given hiding a relationship type orphans nodes (no remaining visible edges),
  when applied, then orphaned nodes remain visible but visually de-emphasised (not removed).
- **Priority:** Must Have

**E3-S3: Filter by property value (visual filter, NOT a query)**
As an enterprise architect, I want to filter nodes by a property value so I find entities matching a
condition.

- **AC:** Given the filter builder, when configured (entity type + property path + operator
  `=,≠,<,>,contains` + value), then it filters **client-side over the already-loaded canvas nodes**
  (visual filtering); it does NOT issue a server query and does NOT overlap the CE Query screen.
- **AC:** Given multiple filters, when combined, then they AND together; each active filter shows as a
  removable chip.
- **AC (failure mode):** Given a property path absent on a node, when filtered, then that node is treated
  as non-matching (excluded), not errored.
- **Priority:** Should Have

**E3-S4: Show/hide governed content layers**

- **AC:** Given the panel, when governed-content toggles (Glossary concepts, Brand standards, Governance
  rules) are used, then those layers show/hide independently of entity-type toggles.
- **AC (failure mode):** Given a governed layer is empty for the current graph, when listed, then its
  toggle is shown disabled with a "no items" hint.
- **Priority:** Should Have

**Epic-level acceptance criteria**

- [ ] No filter or layer toggle in this epic issues a server-side query — all of E3-S1..S4 filter
  client-side over the already-loaded canvas nodes; the CE Query screen remains the sole query-authoring
  surface (FR-013, §2.2).
- [ ] Filters compose predictably and are individually removable: entity-type, relationship-type,
  property, and governed-layer states combine without one toggle silently overriding another, and each
  active property filter shows as a removable chip (multiple property filters AND together).
- [ ] Every filter state that empties the canvas (all entity types off, all relationship types off) shows
  an explicit "re-enable a type" empty-state — the canvas never goes blank without explanation.
- [ ] Edge-case nodes are never silently errored or dropped: a node missing a filtered property path is
  treated as non-matching (excluded); a relationship-type toggle that orphans a node leaves it visible
  but de-emphasised; an empty governed layer shows a disabled toggle with a "no items" hint.

**Dependencies**

- **Blocked by:** EPIC-001 (filters operate on the loaded canvas); Constitution Engine `CE-READ-1`
  (entity/relationship-type and governed-content layer data). EPIC-002 precedes this epic in the roadmap
  sequence.
- **Blocks:** EPIC-004 — overlays (heatmap, domain colouring) are designed to apply with a filter/domain
  focus active; EPIC-007 Saved Views capture active filter state.

**Technical notes**

- Toggling a type off must re-flow layout and, on re-enable, restore positions (coherent with the
  server-side layout persistence in EPIC-001 / D2).
- Governed-content layers (Glossary concepts, Brand standards, Governance rules) toggle independently of
  entity-type toggles — keep the two toggle namespaces separate.
- Property filter operators are fixed (`=, ≠, <, >, contains`); the builder is a visual filter, not a
  query console — do not let it grow into SPARQL authoring.

### EPIC-004 — Visual Overlays

**Phase:** Phase 1 (MVP) · **Priority:** Must / Should Have · **MVP flag:** false · **Provides:** — ·
**Consumes:** CE-READ-1, CE-DIFF-1 · **Depends on:** EPIC-003, CE-READ-1, CE-DIFF-1 · **Blocks:** EPIC-007

Adds colour-and-highlight overlays that surface meaning without changing the graph: a fixed-mapping
heatmap on EA dimensions, a server-computed diff overlay between two published versions, a pinned impact
highlight, and a domain-colouring layer. Overlays compose with the filters and domain focus from earlier
epics.

**User stories**

| Task ID | Title | Priority |
|---------|-------|----------|
| E4-S1 | Heatmap overlay (fixed mappings) | Must Have |
| E4-S2 | Diff overlay between two published versions (D3 / CE-DIFF-1) | Must Have |
| E4-S3 | Impact highlight overlay | Must Have |
| E4-S4 | Domain colouring layer | Should Have |

**E4-S1: Heatmap overlay (fixed mappings)**
As an enterprise architect, I want a heatmap overlay on Capability nodes so I spot weak/underinvested
areas.

- **AC:** Given the heatmap selector (dimension: maturity / investment / strategy / lifecycle), when a
  dimension is chosen, then nodes colour by the **fixed prototype mapping** (`CytoscapeGraph.tsx:43-51`):
  maturity 1→5 = `#ef4444 / #f97316 / #eab308c55eb5cf6`; investment `High/Medium/Low/None`; strategy
  `Differentiation/Innovation/Commodity`; lifecycle `Plan / Phase In / Active / Phase Out / End of Life`.
  These EA fields are **free-text strings** (not store-enforced enums); unmatched values map to neutral
  grey.
- **AC:** Given a node with no value for the chosen dimension, when overlaid, then it shows neutral grey;
  a legend in the bottom corner maps colours to values; the heatmap can apply with a domain filter active.
- **AC (failure mode):** Given a free-text value outside the known vocabulary, when overlaid, then it
  maps to neutral grey and is counted in a "N unrecognised values" legend note (not dropped silently).
- **Priority:** Must Have

**E4-S2: Diff overlay between two published versions (D3 / CE-DIFF-1)**
As a compliance/analyst, I want a diff overlay between two published versions so I see what changed.

- **AC:** Given the version picker (version A vs version B, both published), when applied, then the
  Explorer calls **`CE-DIFF-1`** (`GET /api/ontology/diff?from=<vA>&to=<vB>`) and renders: added
  nodes/edges = green border; removed = red border at **default 0.35 opacity, tunable**; modified nodes
  **and edges** = amber border. Edge modification is **in scope** (server-side diff includes edge mods,
  D3 — this supersedes the prototype's client diff which marked edges add/remove only).
- **AC:** Given a modified element, when clicked, then a before/after property diff is shown from the
  `CE-DIFF-1` `modified[].before/after` payload; a summary panel lists added/removed/modified counts.
- **AC (failure mode):** Given `CE-DIFF-1` returns 4xx/5xx or the two versions are identical, when
  applied, then the overlay shows "no differences" (identical) or a retryable error banner (failure); the
  base canvas is never left in a half-diffed state.
- **Priority:** Must Have

**E4-S3: Impact highlight overlay**

- **AC:** Given an impact trace (E2-S3), when "Pin impact view" is on, then the highlight persists
  through pan/zoom; it is clearable from the sidebar or by right-clicking the source node.
- **AC (failure mode):** Given the source node is deleted while pinned, when detected, then the overlay
  auto-clears with a "source removed" notice.
- **Priority:** Must Have

**E4-S4: Domain colouring layer**

- **AC:** Given domain colouring, when on, then each domain gets a consistent hue applied to member node
  border/background; domain colouring and type colouring are mutually exclusive in v1.
- **AC (failure mode):** Given more domains than the palette has distinct hues (**default 12, tunable**),
  when applied, then hues cycle with a legend disambiguating, rather than silently colliding.
- **Priority:** Should Have

**Epic-level acceptance criteria**

- [ ] Every overlay degrades gracefully instead of corrupting the base canvas: an unrecognised heatmap
  value maps to neutral grey (counted in the legend, not dropped), an identical-version diff shows "no
  differences", a `CE-DIFF-1` 4xx/5xx shows a retryable banner, and a pinned-impact source deletion
  auto-clears the overlay — the canvas is never left in a half-overlaid state.
- [ ] The diff overlay uses the **server-computed** `CE-DIFF-1` result, including **edge modifications**
  (D3) — added=green, removed=red (default 0.35 opacity, tunable), modified (nodes and edges)=amber; it
  does not fall back to a client-side add/remove-only diff.
- [ ] Colour overlays do not collide: domain colouring and type colouring are mutually exclusive in v1,
  and a palette overflow (> default 12 hues, tunable) cycles with a disambiguating legend rather than
  silently reusing a hue.
- [ ] Overlays compose with filters/focus: the heatmap can apply with a domain filter active, and a
  pinned impact highlight (E4-S3) persists through pan/zoom until explicitly cleared.

**Dependencies**

- **Blocked by:** EPIC-003 (overlays apply over filtered/focused canvas — roadmap sequences E4 after E3);
  EPIC-002 E2-S3 (pinned impact overlay consumes the trace); Constitution Engine `CE-DIFF-1` (diff) and
  `CE-READ-1` (heatmap EA fields, domain membership).
- **Blocks:** EPIC-008 — the version-compare story (E8-S2) renders this diff overlay; EPIC-007 Saved Views
  capture active overlay state.

**Technical notes**

- Heatmap uses the **fixed prototype value→colour mappings** (maturity / investment / strategy /
  lifecycle); these EA fields are free-text strings, not store-enforced enums — unmatched values map to
  grey, not error.
- Diff overlay is the shared rendering used by EPIC-008 E8-S2; keep it a reusable overlay driven by the
  `CE-DIFF-1` `added/removed/modified[].before/after` payload.
- The "auto-derived heatmap scheme" idea is explicitly out — only the fixed mappings ship in v1.

### EPIC-005 — Visual Editing on the Canvas (commits via CE-WRITE-1)

**Phase:** Phase 1 (MVP) · **Priority:** Must Have · **MVP flag:** false · **Provides:** — ·
**Consumes:** CE-WRITE-1, PLAT-AUDIT-1 · **Depends on:** EPIC-002, CE-WRITE-1 · **Blocks:** EPIC-009

Turns the canvas into an editor for authorised roles: add a node by double-click, draw an edge by
drag-connect, edit a node's label/properties from the side panel, and delete a node or edge. Every
authoritative write goes through `CE-WRITE-1` (`POST /api/operations/apply`), which SHACL-validates on a
throwaway clone — the Explorer never writes triples directly and editing targets the draft graph only.

> All authoritative writes in this epic go through **`CE-WRITE-1`** (`POST /api/operations/apply`, the
> CE's sole validated mutation entry point — the prototype's legacy auto-apply `/api/llm/mutate` is
> explicitly NOT used). The Explorer never writes triples directly. Authorisation is enforced
> **server-side** at `CE-WRITE-1` (JWT + CE role claim); edit-handle visibility on the canvas is UX only.
> Editing targets the **draft** graph; published versions are read-only. The `CE-WRITE-1` `actor` for a
> **human** visual edit is the editing user's Cognito identity (carried in the JWT); `PLAT-IDENTITY-1`
> mints principals for **agent**-initiated writes only (e.g. an automation embedding the canvas), not
> for direct human edits. Whether human edits also receive a registry-minted principal IRI is OQ-11.

**User stories**

| Task ID | Title | Priority |
|---------|-------|----------|
| E5-S1 | Add a node by double-clicking the canvas | Must Have |
| E5-S2 | Draw an edge by drag-connecting two nodes | Must Have |
| E5-S3 | Edit a node's label or properties from the side panel | Must Have |
| E5-S4 | Delete a node or edge | Must Have |

**E5-S1: Add a node by double-clicking the canvas**
As an enterprise architect (BA role), I want to double-click empty canvas to quick-add an entity.

- **AC:** Given empty canvas, when double-clicked, then a popover opens with a kind selector + label; on
  confirm, an `add_node` op is sent via `CE-WRITE-1`. On `201`, the node renders and its position is
  persisted (E1-S5). On `422 { violations }`, the popover shows the human-readable SHACL violation
  messages.
- **AC (failure mode — optimistic rollback):** Given `CE-WRITE-1` is unreachable or times out (default
  10 s, tunable) after an optimistic node is shown, when the call fails, then the optimistic node is
  rolled back, an error toast appears, and no orphan stays on canvas.
- **Priority:** Must Have

**E5-S2: Draw an edge by drag-connecting two nodes**
As an enterprise architect (BA role), I want to drag from a source node's handle to a target to create a
relationship.

- **AC:** Given a hovered node, when the edge-handle appears, then `edgehandles` config matches the
  prototype: `hoverDelay:150ms, snap:false, preview:true, self-loops blocked (canConnect source≠target)`
  (`CytoscapeGraph.tsx:188-205`). **Handle colour/size are library defaults** in v1 (the "purple
  #7c3aed 12×12px" claim is removed as fabricated); a styled handle is OQ-08.
- **AC:** Given a drag to a target, when `ehcomplete` fires, then a relationship-type picker opens; on
  confirm, an `add_edge` op is sent via `CE-WRITE-1`. On `201` the edge renders; on `422` the picker
  shows the violation.
- **AC (failure mode):** Given the write fails/times out, when detected, then the optimistic edge is
  rolled back and an error toast shown.
- **Priority:** Must Have

**E5-S3: Edit a node's label or properties from the side panel**
As an enterprise architect (BA role), I want to edit a node's label/properties in-place.

- **AC:** Given the side panel, when an editable field (`rdfs:label`, `rdfs:comment`, typed properties of
  the node's OWL class) is saved, then an `update_node` op is sent via `CE-WRITE-1`; on `201` the change
  commits and the CE writes a PROV-O activity + `PLAT-AUDIT-1` entry (attributed to the editing user's
  Cognito identity for human edits; a `PLAT-IDENTITY-1` principal for agent-initiated edits — OQ-11). On
  `422` the field shows the violation.
- **AC (failure mode — concurrent edit):** Given two authorised users edit the same property at near-same
  time (in MVP via separate single-user sessions), when both submit, then writes serialise at
  `CE-WRITE-1`; resolution policy is **last-writer-wins with version check** — the second write is
  accepted if the node version is unchanged, else rejected `409` and the user is notified to reload.
  (Realtime co-edit/CRDT merge is Phase 2, D1.)
- **Priority:** Must Have

**E5-S4: Delete a node or edge**
As an enterprise architect (BA role), I want to delete a node/edge.

- **AC:** Given a node with incoming references, when delete is invoked, then a warning lists affected
  relationships before commit; delete requires explicit confirmation (never instant).
- **AC:** Given confirmation, when committed, then a `delete_node`/`delete_edge` op is sent via
  `CE-WRITE-1`; the CE's delete cleans up reification/annotation statements server-side, and the
  **cascaded removal of those annotated edges/statements is reflected on the canvas** after the write
  returns — the canvas re-reconciles from the CE response, it does not assume only the selected element
  was removed.
- **AC (failure mode):** Given the delete fails/times out, when detected, then nothing is removed from
  canvas and an error toast is shown (no optimistic delete of a node that may still exist server-side).
- **Priority:** Must Have

**Epic-level acceptance criteria**

- [ ] All four operations (add node, add edge, update, delete) commit **only** via `CE-WRITE-1`; none
  writes triples directly, and none uses the legacy `/api/llm/mutate` auto-apply endpoint.
- [ ] Edit authorisation is enforced **server-side at `CE-WRITE-1`** (JWT + CE role claim:
  ontologist=structure, BA=instances, viewer=read-only); canvas edit-handle visibility is UX only and is
  never the security control — a write attempted without the role is rejected by the CE even if the
  handle was visible.
- [ ] Failure handling is uniform across the four ops: on a `422`, the human-readable SHACL violation is
  surfaced inline; on a `CE-WRITE-1` timeout (default 10 s, tunable), the optimistic add/edge/update rolls
  back leaving no orphan, and a failed delete removes nothing from the canvas (no phantom delete of a node
  still present server-side).
- [ ] Each committed write is attributed correctly: a human edit's `CE-WRITE-1` actor is the editing
  user's Cognito identity (PROV-O + `PLAT-AUDIT-1` stamp written by the CE); a concurrent same-prop edit
  serialises last-writer-wins with version check, the stale write rejected `409`.
- [ ] A delete re-reconciles the canvas from the CE response — cascaded removal of reification /
  annotation statements is reflected, rather than assuming only the selected element was removed.

**Dependencies**

- **Blocked by:** EPIC-001 (canvas + edge-handles + side panel + layout persistence); EPIC-002 precedes
  E5 in the roadmap sequence; Constitution Engine `CE-WRITE-1` (sole validated mutation entry point);
  Platform `PLAT-IDENTITY-1` (agent-initiated write principals; human edits use Cognito identity — OQ-11)
  and `PLAT-AUDIT-1` (read-only `seq` correlation).
- **Blocks:** EPIC-009 — `GE-CANVAS-1` reuses these edit flows for Build's project-architecture write-back
  (roadmap sequences E9 after E5).

**Technical notes**

- `edgehandles` config matches the prototype (`hoverDelay:150ms`, `snap:false`, `preview:true`, self-loops
  blocked); handle colour/size are **library defaults** in v1 — a styled handle is OQ-08, not asserted
  here.
- Editing targets the **draft** graph; published versions are read-only (EPIC-008). The realtime co-edit /
  CRDT merge path is Phase 2 (D1) — MVP concurrency is last-writer-wins with version check.
- Whether a human edit also receives a `PLAT-IDENTITY-1`-minted principal IRI in PROV-O/audit is **OQ-11**.

### EPIC-006 — Async Share & Comments (MVP) — Realtime Collaboration is Phase 2

**Phase:** Phase 1 (MVP) for S1-S3; Phase 2 (Realtime Collaboration) for S4-S5 · **Priority:** Must /
Should Have · **MVP flag:** false · **Provides:** — · **Consumes:** PLAT-NOTIFY-1, CE-EVENT-1, CE-READ-1
· **Depends on:** EPIC-007, PLAT-NOTIFY-1, CE-EVENT-1, CE-READ-1 · **Blocks:** —

Provides the MVP collaboration model — single-user editing plus asynchronous sharing: share a Saved View
with named colleagues, comment on a node or view, and live-refresh on upstream graph changes (poll
fallback in MVP). The realtime stories (co-editing, presence, follow-me) are deferred to Phase 2 (D1) and
carried here as forward-looking rows, not MVP scope.

> **D1:** Realtime multi-user co-editing, live presence, cursors, and follow-me are **Phase 2**
> (Yjs/CRDT, sync transport, scaling). The MVP collaboration model is **single-user editing + async
> sharing**: a user shares a Saved View, others open it asynchronously and leave comments. This epic
> replaces the former realtime Epic 6; the realtime stories are preserved as Phase 2 below.

**User stories**

| Task ID | Title | Priority |
|---------|-------|----------|
| E6-S1 | Share a Saved View asynchronously | Must Have |
| E6-S2 | Comment on a node or a Saved View | Must Have |
| E6-S3 | Live refresh on upstream graph change (degrade to poll) | Should Have |
| E6-S4 | Realtime co-editing, presence, cursors | Won't (MVP) / Must (Phase 2) |
| E6-S5 | Workshop "Follow me" mode | Won't (MVP) / Should (Phase 2) |

**E6-S1: Share a Saved View asynchronously**
As any user, I want to share a Saved View with named workspace colleagues so they can open the same lens
later.

- **AC:** Given a Saved View (E7), when "Share" is used, then selected workspace members get an in-app
  notification via **`PLAT-NOTIFY-1`** ("X shared a view with you", deep-link to the view); delivery is
  in-app (+ Slack if the recipient opted in). Sharing is scoped to the same tenant/workspace.
- **AC (failure mode):** Given a recipient lacks viewer access to the underlying graph, when the share is
  sent, then they receive no notification and the sharer sees "N recipients lack access" (no cross-tenant
  or unauthorised leak).
- **Priority:** Must Have · **Phase / depends-on:** MVP, depends-on PLAT-NOTIFY-1

**E6-S2: Comment on a node or a Saved View**
As any user, I want to leave a comment on a node or a shared view so we can discuss the model
asynchronously.

- **AC:** Given a node or Saved View, when a comment is added, then it persists **server-side** in an
  Explorer-owned Aurora table (tenant + workspace scoped; not graph data, not an inter-engine contract),
  with author, timestamp, and target (node IRI or view id), and is visible to workspace members on that
  target.
- **AC (failure mode):** Given the comment write fails, when submitted, then the draft comment text is
  preserved client-side with a retry control; comments are never silently lost.
- **Priority:** Must Have · **Phase / depends-on:** MVP

**E6-S3: Live refresh on upstream graph change (Should Have, degrade to poll)**
As any user, I want the canvas to reflect a change another user committed without a manual reload.

- **AC:** Given the Explorer is subscribed to **`CE-EVENT-1`** for the current graph, when CE emits a
  change event (`added/updated/deleted/constraint-violated`), then the affected element is reconciled in
  place and a subtle "graph updated" indicator shows.
- **AC (failure mode / degradation):** Given the `CE-EVENT-1` stream is unavailable, when subscribing
  fails, then the Explorer **degrades to polling `CE-READ-1`** with a since-version cursor at a **default
  30 s interval, tunable per workspace**; the user is not blocked.
- **Priority:** Should Have · **Phase / depends-on:** MVP for poll fallback; live stream when CE-EVENT-1
  ships

**E6-S4 (Phase 2): Realtime co-editing, presence, cursors**
As a workshop facilitator, I want multiple users live on the same canvas with cursors and presence.

- **AC:** Given a live session, when ≥ 2 users are active (target **default 5 concurrent, tunable**), then
  each sees others' cursors (name/initials), independent viewports, and node drags reflected with
  **default ≤ 500 ms p95 latency, tunable** (LAN/good broadband); CRDT (Yjs) merges ephemeral canvas/
  presence state while authoritative writes still serialise through `CE-WRITE-1`.
- **AC (security):** Given a CRDT sync room, when a client connects, then the sync server validates the
  Cognito JWT tenant claim against the room id (room id includes the tenant id); a mismatched tenant is
  rejected at connect — client-side gating is never the boundary.
- **AC (failure mode):** Given the sync transport drops mid-session, when reconnecting, then local edits
  replay and converge with no lost updates; duplicate-IRI creates reconcile at `CE-WRITE-1`.
- **Priority:** Won't Have (MVP) / Must Have (Phase 2) · **Phase / depends-on:** Phase 2; OQ-02/OQ-07

**E6-S5 (Phase 2): Workshop "Follow me" mode**
As a facilitator, I want followers' viewports to follow mine.

- **AC:** Given follow-me on, when followers join, then their pan/zoom sync to the facilitator (a banner
  indicates following) and follow only viewport, not selection/editing; followers break out by
  panning/zooming.
- **Priority:** Won't Have (MVP) / Should Have (Phase 2) · **Phase / depends-on:** Phase 2; OQ-07

**Epic-level acceptance criteria**

- [ ] Async sharing never leaks across access boundaries: a recipient lacking viewer access to the
  underlying graph receives no notification, the sharer sees "N recipients lack access", and sharing is
  scoped to the same tenant/workspace — no cross-tenant or unauthorised view exposure.
- [ ] No user-authored content is silently lost: a failed comment write preserves the draft text
  client-side with a retry control, and live-refresh degrades from the `CE-EVENT-1` stream to polling
  `CE-READ-1` (since-version cursor, default 30 s, tunable) without blocking the user.
- [ ] The MVP collaboration model is strictly single-user + async (S1-S3): no realtime co-editing,
  presence, cursors, or follow-me ships in Phase 1 — S4-S5 are Phase 2 only and do not gate the Phase-1
  boundary.
- [ ] (Phase 2) A CRDT sync-room connection validates the Cognito JWT tenant claim against the room id
  (room id includes the tenant id) and rejects a mismatch at connect — client-side gating is never the
  boundary; reconnects replay local edits and converge with no lost updates.

**Dependencies**

- **Blocked by:** EPIC-007 (sharing acts on Saved Views — roadmap sequences E6 after E7); EPIC-001
  (comments target node IRIs on the canvas); Platform `PLAT-NOTIFY-1` (share notifications); Constitution
  Engine `CE-EVENT-1` (live stream; MVP uses the `CE-READ-1` poll fallback). Comments persist in an
  Explorer-owned Aurora table (internal). Phase-2 stories additionally depend on OQ-02 (Yjs sync
  transport/scaling) and OQ-07 (follow-me transport).
- **Blocks:** Phase-1 boundary gate (S1-S3 are MVP exit criteria); Phase-2 boundary gate (S4-S5).

**Technical notes**

- This single epic spans both phases: S1-S3 ship in Phase 1 (MVP); S4-S5 are Phase 2 (D1) — do not split
  into two epics, but budget the Phase-2 stories (Yjs/CRDT, sync transport, scaling) separately.
- FR-025 live-refresh ships as **poll fallback only** in Phase 1; the `CE-EVENT-1` live-stream upgrade
  activates when CE-EVENT-1 ships (Phase 2).
- Authoritative writes still serialise through `CE-WRITE-1` even in the Phase-2 CRDT model — the CRDT
  carries ephemeral presence/canvas state, not the source of truth.

### EPIC-007 — Saved Views & Layout (server-side, team-shared — D2)

**Phase:** Phase 1 (MVP) · **Priority:** Must / Should Have · **MVP flag:** false · **Provides:** — ·
**Consumes:** PLAT-SETTINGS-1 · **Depends on:** EPIC-004, PLAT-SETTINGS-1 · **Blocks:** EPIC-006

Lets users capture a configured canvas — filters, overlays, domain focus, viewport, and the server-side
layout positions — as a named view, share it across the workspace library, and feature pinned views. All
state is persisted server-side and team-shared (D2), resolving the per-browser-localStorage vs
shared-view contradiction.

**User stories**

| Task ID | Title | Priority |
|---------|-------|----------|
| E7-S1 | Save current canvas state as a named view | Must Have |
| E7-S2 | Workspace-shared view library | Must Have |
| E7-S3 | Featured (pinned) views | Should Have |

**E7-S1: Save current canvas state as a named view**
As any user, I want to save my canvas state with a name so I reopen it without re-configuring.

- **AC:** Given the canvas, when "Save view" is used, then it captures active filters, active overlays,
  domain focus, viewport (pan/zoom), and the **server-side layout positions** for that view (D2 — not read
  from per-browser `localStorage`, resolving the positions/shared-view contradiction); a name is required,
  description optional. Persisted in an Explorer-owned Aurora table scoped by (tenant, workspace).
- **AC (failure mode):** Given a name collision in the workspace, when saving, then the user is prompted
  to overwrite or rename (no silent clobber).
- **Priority:** Must Have

**E7-S2: Workspace-shared view library**

- **AC:** Given Saved Views, when the panel opens, then it lists all views in the workspace with creator
  and last-updated; any workspace member can open; a creator can delete their own; a **workspace admin**
  (`PLAT-SETTINGS-1` RBAC) can delete any.
- **AC (failure mode):** Given a view references entities deleted since it was saved, when opened, then it
  loads what still exists and flags "N items in this view no longer exist".
- **Priority:** Must Have

**E7-S3: Featured (pinned) views**

- **AC:** Given the library, when a workspace admin pins a view, then up to **default 5 pinned, tunable
  per workspace** appear in a "Featured" section at the top.
- **AC (failure mode):** Given the pin limit is reached, when another pin is attempted, then the admin is
  prompted to unpin one first (no silent overflow).
- **Priority:** Should Have

**Epic-level acceptance criteria**

- [ ] A Saved View round-trips faithfully across users: a view capturing filters + overlays + domain focus
  + viewport + **server-side layout** saved by one workspace member reopens for a different member with
  the same layout and lens — positions come from the view's server-side store, not per-browser
  `localStorage` (D2).
- [ ] Views and their layout/comments are tenant + workspace scoped: a tenant-A JWT listing or opening
  Saved Views returns **zero tenant-B views** (cross-tenant isolation, §2.2).
- [ ] Governance is role-correct: any workspace member can open a view, a creator can delete their own,
  and only a workspace **admin** (`PLAT-SETTINGS-1` RBAC) can delete any or pin — a non-admin cannot
  delete another's view or exceed the pin limit.
- [ ] No silent data loss or overflow: a name collision prompts overwrite/rename (no silent clobber),
  reaching the pin limit (default 5, tunable) prompts to unpin first, and a view referencing
  since-deleted entities loads what still exists and flags "N items no longer exist".

**Dependencies**

- **Blocked by:** EPIC-004 (views capture active overlays — roadmap sequences E7 after E4); EPIC-001
  (server-side layout positions) and EPIC-003 (filters), EPIC-002 (domain focus) whose state the view
  captures; Platform `PLAT-SETTINGS-1` (tenancy/RBAC cascade, workspace-admin governance). Saved Views /
  layout live in an Explorer-owned Aurora table (internal, not an inter-engine contract).
- **Blocks:** EPIC-006 — async share (E6-S1) shares a Saved View; roadmap sequences E6 after E7.

**Technical notes**

- Saved Views, server-side layout positions, and comments are **Explorer-internal** Aurora tables (tenant
  + workspace scoped, `tenant_id` + `workspace_id` on every row) — intentionally **not** inter-engine
  contracts and carrying no contract ID.
- The view layout is the same server-side layout store as EPIC-001 (D2); a shared view persists its
  positions with the view so a second user reproduces them.
- Writes (save/share/pin) use parameterised queries — no string concatenation into SQL (project security
  rule); retry with backoff, never silently dropped.

### EPIC-008 — Version Views & Diff (visualises CE versioning)

**Phase:** Phase 1 (MVP) · **Priority:** Must Have · **MVP flag:** true · **Provides:** — ·
**Consumes:** CE-VERSION-1, CE-READ-1, CE-DIFF-1 · **Depends on:** EPIC-001, CE-VERSION-1, CE-READ-1,
CE-DIFF-1 · **Blocks:** —

Makes the Constitution Engine's versioning visible on the canvas: list and load any published version
read-only (`CE-VERSION-1` / `CE-READ-1`), and diff any two published versions via the server-computed
`CE-DIFF-1` overlay. The Explorer visualises versioning; it does not own the versioning lifecycle.

**User stories**

| Task ID | Title | Priority |
|---------|-------|----------|
| E8-S1 | View a specific published version (read-only) | Must Have |
| E8-S2 | Visual diff between two published versions | Must Have |

**E8-S1: View a specific published version (read-only)**
As a compliance/analyst, I want to view the canvas in a historical published state to audit it.

- **AC:** Given the Versions & Diff panel, when it opens, then it lists published versions (timestamp +
  semver) from **`CE-VERSION-1`** (`GET /api/ontology/versions`). Selecting a version loads that version's
  graph via `CE-READ-1` (`?version=<iri>`, paginated, no silent cap — B3) **read-only**; editing is
  disabled and a banner indicates "viewing historical version, not the current draft".
- **AC:** Given the default load, when no version is selected, then the canvas shows the **current draft**
  (editable for authorised roles); `version=latest` resolves to the newest published version for
  read-only viewing (B2) — the draft and "latest published" are distinct targets.
- **AC (failure mode — scale):** Given a version graph exceeds one page, when loaded, then the Explorer
  pages through `CE-READ-1` (no 500-row cap exists post-B3); if total retrieval exceeds a **default
  10,000-node soft ceiling (tunable)**, then a "large historical graph" banner + incremental load is
  shown. A dedicated CE bulk/CONSTRUCT graph-export endpoint for whole-version retrieval is OQ-03 (owner:
  CE/Architect).
- **Priority:** Must Have

**E8-S2: Visual diff between two published versions**
As a compliance/analyst, I want to diff any two published versions from the panel.

- **AC:** Given the panel, when "Compare versions (A vs B)" is used, then the diff overlay (E4-S2 via
  `CE-DIFF-1`, server-computed incl. edge mods) renders on the canvas and a summary is exportable.
- **AC (failure mode):** Given export is requested, then a JSON entity-summary is produced in v1 (PDF/CSV
  deferred — OQ-06); if export fails, the on-screen summary remains available.
- **Priority:** Must Have

**Epic-level acceptance criteria**

- [ ] The draft and "latest published" are distinct load targets: the default canvas shows the editable
  **draft**; selecting a published version (or `version=latest`) loads it **read-only** with editing
  disabled and a "viewing historical version" banner — a published version can never be edited.
- [ ] A tenant-A JWT loading any version graph or diff returns **zero tenant-B triples** (cross-tenant
  isolation, §2.2).
- [ ] Version loads never silently truncate: graphs are paged through `CE-READ-1` (no 500-row cap
  post-B3), and a graph exceeding the soft ceiling (default 10,000 nodes, tunable) shows a "large
  historical graph" banner with incremental load rather than a partial canvas.
- [ ] The diff reuses the EPIC-004 `CE-DIFF-1` overlay (server-computed, incl. edge mods); an identical
  pair shows "no differences", a CE error shows a retryable banner, and the on-screen summary remains
  available even if JSON export fails.

**Dependencies**

- **Blocked by:** EPIC-001 (canvas rendering — roadmap sequences E8 after E1); EPIC-004 (reuses the diff
  overlay); Constitution Engine `CE-VERSION-1` (version list + canonical lag) and `CE-READ-1`
  (`?version=<iri>` read-only load); `CE-DIFF-1` (server-computed diff incl. edge mods).
- **Blocks:** Nothing downstream within Graph Explorer; satisfies the compliance/audit PRD-level
  acceptance criteria (§2.6).

**Technical notes**

- `version=latest` resolves to the newest published version for read-only viewing (B2); it is **not** the
  draft — keep the two targets explicitly distinct.
- Diff export is **JSON entity-summary in v1**; PDF/CSV and whether export is a CE-owned report endpoint
  are deferred to **OQ-06**.
- Whole-version retrieval above one page (a dedicated CE bulk/CONSTRUCT export endpoint vs paginated
  `CE-READ-1` SELECT at scale) is **OQ-03**, owned by CE/Architect — do not assume a bulk endpoint exists.

### EPIC-009 — Embeddable Canvas Component — GE-CANVAS-1 (this engine PROVIDES)

**Phase:** Phase 1 (MVP) · **Priority:** Must Have · **MVP flag:** false · **Provides:** GE-CANVAS-1 ·
**Consumes:** CE-READ-1, CE-WRITE-1, PLAT-IDENTITY-1 · **Depends on:** EPIC-005, CE-READ-1, CE-WRITE-1 ·
**Blocks:** Build Engine (#4)

Packages the Explorer canvas as the parameterised, embeddable `GE-CANVAS-1` component (modes
`force` | `c4`) that the Build Engine mounts scoped to a project IRI. The Explorer owns the component and
the C4 mode; Build embeds a project-scoped slice and writes project architecture back via `CE-WRITE-1`.
This is the contract that unblocks the Build Engine.

**User stories**

| Task ID | Title | Priority |
|---------|-------|----------|
| E9-S1 | Provide the parameterised embeddable canvas | Must Have |

**E9-S1: Provide the parameterised embeddable canvas**
As the Build Engine, I want to embed the Explorer's canvas scoped to a project so I show a project's
architecture without rebuilding a viewer.

- **AC:** Given a host (Build), when it mounts `GE-CANVAS-1` with props `{ source, filterByIri, mode:
  "force"|"c4", readonly, version }`, then the component renders the matching slice: `filterByIri =
  <project IRI>` scopes to entities tagged with that project; `mode` selects force-directed or the
  structured **C4** view (resolves the dual-canvas scope gap — C4 mode is IN, owned by Explorer);
  `readonly` disables editing; `version` pins the read.
- **AC:** Given Build makes a project-architecture edit through the embedded canvas, when committed, then
  the write goes back through **`CE-WRITE-1`** (Explorer owns the component; Build manages its project
  portion — bidirectional sync per the contract).
- **AC (failure mode):** Given `filterByIri` matches no entities, when mounted, then the component renders
  an empty-state, not an error; given `mode:"c4"` with no structural data, it falls back to a "no C4
  structure modelled" state.
- **Priority:** Must Have · **Phase / depends-on:** MVP for `force` mode + embedding; `c4` mode P0 within
  MVP

**Epic-level acceptance criteria**

- [ ] Mounting `GE-CANVAS-1` with `{ source, filterByIri, mode, readonly, version }` renders the matching
  slice for **both** `force` and `c4` modes: `filterByIri` scopes to the project's entities, `mode`
  selects force-directed or the structured C4 view (Explorer owns C4), `readonly` disables editing, and
  `version` pins the read.
- [ ] A project-architecture edit made through the embedded canvas writes back through `CE-WRITE-1` (the
  same server-side authz boundary as EPIC-005) — the embedded component never writes triples directly, and
  Build manages only its project portion.
- [ ] The component degrades to empty-states, never errors: a `filterByIri` matching no entities renders
  an empty-state, and `mode:"c4"` with no structural data falls back to a "no C4 structure modelled" state.
- [ ] Embedding preserves tenant isolation: a host mounting the component under a tenant-A context
  surfaces **zero tenant-B entities** (cross-tenant isolation, §2.2), regardless of `filterByIri`.

**Dependencies**

- **Blocked by:** EPIC-001 (the canvas it packages) and EPIC-005 (the write-back edit flows — roadmap
  sequences E9 after E5); Constitution Engine `CE-READ-1` (slice load) and `CE-WRITE-1` (write-back).
- **Blocks:** **Build Engine (#4)** — it embeds the project-scoped `GE-CANVAS-1` slice; this epic is the
  `GE-CANVAS-1` provided contract that unblocks Build. Release is gated by the scoped publish/generate
  HITL gate.

**Technical notes**

- `GE-CANVAS-1` is the engine's **only provided inter-engine contract** (stability: beta — force MVP, c4
  MVP); shape per `../contracts.md §3`. Build embeds it and writes back per the bidirectional-sync
  contract.
- C4 mode is **net-new** (the prototype's React-Flow canvas is not productionised) — the architect budgets
  c4 mode distinctly from force mode; both are P0 within the MVP.
- The component release to Build is the only "released artefact" of this engine; it passes the scoped
  publish/generate gate (PO + Tech lead), not an ontology publish (CE's) nor a generated-artefact release
  (Build's).

## 4. Roadmap

**Program roadmap:** see [`../weave-spec.md`](../weave-spec.md#1-program-plan) §Program. Cross-engine
dependencies cite contract IDs from [`../contracts.md`](../contracts.md).

### Position in the build order

Weave build order: **Platform shell → Constitution → Graph Explorer → Build → Events → Onboarding**.
This engine is **#3** — the first surface on the platform shell after the Constitution Engine, and the
visualise half of the MVP thin loop (Platform shell + CE model + Explorer visualise + a narrow Build
slice that generates one artefact, proving model→generate).

**Depends on** (all upstream of #3 in the build order, so available when Explorer starts; consumed by
contract ID):

- Constitution Engine (#2): `CE-READ-1` (graph/node-kinds/version load, SPARQL property-path traversal),
  `CE-WRITE-1` (all authoritative node/edge writes; server-side authz boundary), `CE-DIFF-1` (server diff
  incl. edge mods), `CE-VERSION-1` (version list + canonical lag). `CE-EVENT-1` (live graph-change stream)
  is **the one engine-gated item**: MVP ships the poll fallback over `CE-READ-1`; the live-stream upgrade
  activates when `CE-EVENT-1` ships.
- Platform shell (#1): `PLAT-NOTIFY-1` (share notifications), `PLAT-SETTINGS-1` (tenancy/RBAC cascade,
  workspace-admin governance), `PLAT-IDENTITY-1` (agent-initiated write principals), `PLAT-AUDIT-1`
  (read-only audit `seq` correlation).

**Unblocks:** Build Engine (#4) — Explorer **provides** `GE-CANVAS-1` (embeddable `force|c4` canvas);
Build embeds the project-scoped slice and writes project architecture back via `CE-WRITE-1`. Work that is
contract-unblocked may run in parallel — see the program roadmap.

### Phase overview (gantt)

```mermaid
gantt
    title Graph Explorer Roadmap
    dateFormat YYYY-MM-DD
    section Phase 1 (MVP — visualise + edit + async share)
        E1 Whole-Company Canvas      :e1, 2026-01-01, 8d
        E8 Version Views & Diff      :e8, after e1, 5d
        E2 Drill-In & Domain Focus   :e2, after e1, 5d
        E3 Filters & Layers          :e3, after e2, 5d
        E4 Visual Overlays           :e4, after e3, 5d
        E5 Visual Editing (CE-WRITE) :e5, after e2, 7d
        E7 Saved Views & Layout      :e7, after e4, 5d
        E6 Async Share & Comments    :e6, after e7, 4d
        E9 GE-CANVAS-1 embeddable    :e9, after e5, 5d
        HITL: Phase-1 boundary gate  :milestone, m1, after e6, 0d
    section Phase 2 (Realtime collaboration)
        E6 Realtime co-edit/presence :p2a, after m1, 8d
        E6 Follow-me + CE-EVENT-1    :p2b, after p2a, 5d
        HITL: Phase-2 boundary gate  :milestone, m2, after p2b, 0d
```

### Phase 1: MVP — Visualise, Edit & Async Share · MVP

**Goal:** A user opens the Explorer and sees the company operating model as a force-directed canvas;
finds, spotlights, filters, overlays and drills into it without RDF/SPARQL; makes SHACL-validated visual
edits through `CE-WRITE-1`; views/diffs published versions; saves and async-shares team views; and the
embeddable `GE-CANVAS-1` (`force|c4`) is available for the Build Engine. This is the *visualise* half of
the MVP thin loop — single-user editing plus asynchronous sharing, **no realtime co-editing** (D1).

**Epics:**

| Epic | Description | Stories | Priority | MVP? |
|------|-------------|---------|----------|------|
| EPIC-001 (E1) | Whole-Company Canvas (force mode): load draft graph via `CE-READ-1`, colour by node-kind, pan/zoom, spotlight, search, server-side layout persistence | 5 | Must Have | yes |
| EPIC-002 (E2) | Drill-In & Domain Focus: focus a domain, expand/collapse neighbourhood, impact/dependency trace via CE SPARQL property-path | 3 | Must Have | yes |
| EPIC-003 (E3) | Filters & Layers: entity-type and relationship-type toggles, client-side property filter, governed-content layers | 4 | Must/Should Have | yes |
| EPIC-004 (E4) | Visual Overlays: fixed heatmap mappings, version diff overlay (`CE-DIFF-1`), pinned impact, domain colouring | 4 | Must/Should Have | yes |
| EPIC-005 (E5) | Visual Editing on the Canvas: add/edit/delete node, draw edge — all committed via `CE-WRITE-1` with optimistic rollback | 4 | Must Have | yes |
| EPIC-006 (E6) | Async Share & Comments (MVP stories only — S1 share, S2 comments, S3 live-refresh poll fallback) | 3 | Must/Should Have | yes |
| EPIC-007 (E7) | Saved Views & Layout (server-side, team-shared, D2): save view, workspace-shared library, featured pins | 3 | Must/Should Have | yes |
| EPIC-008 (E8) | Version Views & Diff: view a published version read-only (`CE-VERSION-1`/`CE-READ-1`), diff two versions (`CE-DIFF-1`) | 2 | Must Have | yes |
| EPIC-009 (E9) | Embeddable Canvas Component `GE-CANVAS-1` (`force` + `c4` modes) — provided to Build Engine | 1 | window¹ |

> **¹ MVP-exit gates vs MVP-window (audit M2).** Only **E1 (render)** + **E8 (diff)** are thin-loop MVP
> *exit gates* — the visualise step the program MVP depends on. **E5 (visual editing), E6 (async share),
> E7 (saved views), E9 (`GE-CANVAS-1`)** ship in the MVP *window* but are **not** thin-loop exit gates and
> have no MVP consumer — `GE-CANVAS-1`'s first consumer is Build Phase 2, so **E9 may slip to Phase 2
> without blocking the MVP**. Scheduled here for parallelism, not as gates.

> Epic count: 9 (E6 contributes 3 of its 5 stories here; the remaining 2 are Phase 2). FR coverage:
> FR-001–FR-025 and FR-028–FR-034. FR-025 ships as **poll fallback only** in this phase; the `CE-EVENT-1`
> live-stream upgrade lands when CE-EVENT-1 ships.

**Entry criteria (Definition of Ready):**

- [ ] PRD approved; Phase-1 tech spec approved (C4, OpenAPI/component contract for `GE-CANVAS-1`, data
  model for Explorer-owned Aurora tables — views/layout/comments).
- [ ] Tasks decomposed; each task brief passes the DoR gate (`arch-dor`).
- [ ] Upstream contracts available and stubbable: `CE-READ-1`, `CE-WRITE-1`, `CE-DIFF-1`, `CE-VERSION-1`
  (Constitution Engine #2 shipped), and `PLAT-NOTIFY-1`, `PLAT-SETTINGS-1`, `PLAT-IDENTITY-1`,
  `PLAT-AUDIT-1` (Platform shell #1 shipped). Integration tests run against CE stubs until live.
- [ ] OQ-01 benchmark harness defined (browser, hardware, node/edge count, fps sampling) so the
  performance exit criterion is measurable rather than asserted.

**Exit criteria (EARS, measurable, human-signed):**

- [ ] WHEN an authenticated viewer opens the Explorer THE SYSTEM SHALL render the current draft graph via
  `CE-READ-1` as a Cytoscape/fcose force canvas, coloured by CE node-kind, with first interactive render
  within **default ≤ 3 s at 1k nodes / ≤ 8 s at 10k nodes (p95), tunable** — verified by the OQ-01
  performance harness against a realistic graph.
- [ ] WHEN a business-role (viewer) user searches and clicks a result THE SYSTEM SHALL centre and
  spotlight that node and show its label/type/key-props **without exposing a raw IRI** — verified by
  E1-S3/E1-S4 E2E test.
- [ ] WHEN a BA-role user double-clicks the canvas to add a node THE SYSTEM SHALL commit it via
  `CE-WRITE-1`, surface any `422` SHACL violation as human-readable text, and roll back the optimistic
  node on a `CE-WRITE-1` timeout (**default 10 s, tunable**) with no orphan left on canvas — verified by
  E5-S1 integration test against a CE stub returning `201` and `422`.
- [ ] WHEN a user requests a diff of two published versions THE SYSTEM SHALL call `CE-DIFF-1` and render
  added (green) / removed (red, default 0.35 opacity, tunable) / modified-incl-edges (amber), or "no
  differences" when identical — verified by E4-S2/E8-S2 test.
- [ ] WHEN a user saves a team view (filters + overlays + domain focus + **server-side layout**) and
  shares it THE SYSTEM SHALL notify eligible recipients via `PLAT-NOTIFY-1`, exclude recipients lacking
  graph access (no leak), and reproduce the same layout for a different workspace user — verified by
  E6-S1/E7-S1 integration test.
- [ ] WHEN the Build Engine mounts `GE-CANVAS-1` with `{filterByIri, mode}` in both `force` and `c4` modes
  THE SYSTEM SHALL render the project-scoped slice and write a project-architecture edit back via
  `CE-WRITE-1` — verified by the `GE-CANVAS-1` contract conformance test.
- [ ] WHEN any Explorer read is issued under a tenant-A JWT THE SYSTEM SHALL return **zero tenant-B
  rows/triples** across graph load, Saved Views, comments, and diff — verified by the required
  cross-tenant isolation test (§2.2).
- [ ] Coverage ≥ 80% (default, tunable) · mutation ≥ 70% (default, tunable) · 0 blocking bugs · zero
  axe-core violations on the non-canvas UI in CI (default, tunable).
- [ ] **Measurable artefacts delivered:** the deployed Explorer module, the published `GE-CANVAS-1`
  component contract conformance report, the OQ-01 performance-benchmark report, and the cross-tenant
  isolation test report.
- [ ] **Human sign-off recorded** (always the final exit criterion).

**HITL gates (configurable for this phase — declare which are active):**

| Gate | Active? | Approver | Blocks |
|------|---------|----------|--------|
| Spec-approval (PO/stakeholder sign-off) | **mandatory** | PO + EA stakeholder | phase start |
| Phase-boundary ceremony (security-review + mutation + doc-gen) | yes | PO + Tech lead | phase-2 |
| Pre-AWS-deploy (full local pyramid + gates green → approve → dev-AWS smoke) | yes | Tech lead | deploy |
| Publish/generate (GE-CANVAS-1 component release to Build) | yes (scoped to `GE-CANVAS-1` only) | PO + Tech lead | GE-CANVAS-1 release |

> HITL gates are project/workspace-configurable; only spec-approval is globally mandatory. The
> pre-AWS-deploy gate enforces `../dev-environment.md §4`: full local pyramid + all quality gates green →
> HITL approval → dev-AWS smoke → promote. The publish/generate gate is **scoped narrowly to the
> `GE-CANVAS-1` component release** (Explorer's only "released artefact"); it is **not** an ontology
> publish (that is CE's) nor a generated-artefact release (that is Build's).

**Phase-gate metadata** (evaluated by the phase-gate Stop hook / `/goal` condition):

```text
phase: 1
gate_id: graph-explorer-gate-1
condition: all_exit_criteria_met
approver: PO + Tech lead
blocks: phase-2
```

### Phase 2: Realtime Collaboration

**Goal:** Figma-style live multi-user collaboration on the canvas — presence, cursors, concurrent drags,
follow-me — built on a CRDT (Yjs), with authoritative writes still serialised through `CE-WRITE-1`; plus
the `CE-EVENT-1` live-stream upgrade of live-refresh (replacing the Phase-1 poll fallback).
**Dependencies:** Phase 1 gate passed; CRDT sync transport + scaling decided (OQ-02/OQ-07); `CE-EVENT-1`
shipped.

**Epics:**

| Epic | Description | Stories | Priority | MVP? |
|------|-------------|---------|----------|------|
| EPIC-006 (E6, Phase-2 stories) | Realtime co-editing + presence/cursors (E6-S4, Yjs CRDT) and workshop "Follow me" viewport sync (E6-S5); plus the `CE-EVENT-1` live-stream upgrade of FR-025 live-refresh | 2 | Won't (MVP) / Must+Should (P2) | no |

> FR coverage: FR-026 (realtime co-edit + presence), FR-027 (follow-me), and the live-stream half of
> FR-025 (CE-EVENT-1). All Phase-2 thresholds are "default X, tunable".

**Entry criteria (Definition of Ready):**

- [ ] Phase 1 gate passed and human sign-off recorded.
- [ ] Phase-2 PRD section + tech spec approved (CRDT sync transport, scaling, tenant-scoped sync rooms).
- [ ] Tasks decomposed; each task brief passes the DoR gate.
- [ ] OQ-02 (Yjs sync transport + scaling) and OQ-07 (follow-me transport) resolved at tech spec;
  `CE-EVENT-1` shipped and subscribable.

**Exit criteria (EARS, measurable, human-signed):**

- [ ] WHEN ≥ 2 users are active in a live session (target **default 5 concurrent, tunable**) THE SYSTEM
  SHALL show each other's cursors and reflect node drags with **default ≤ 500 ms p95 latency, tunable**,
  while authoritative writes still serialise through `CE-WRITE-1` — verified by a multi-user load +
  convergence test.
- [ ] WHEN a client connects to a CRDT sync room THE SYSTEM SHALL validate the Cognito JWT tenant claim
  against the room id and **reject a tenant mismatch at connect** (client-side gating is never the
  boundary) — verified by a sync-room cross-tenant rejection test.
- [ ] WHEN the sync transport drops mid-session and reconnects THE SYSTEM SHALL replay local edits and
  converge with **no lost updates** (duplicate-IRI creates reconcile at `CE-WRITE-1`) — verified by a
  reconnect/convergence test.
- [ ] WHEN `CE-EVENT-1` emits a graph-change event THE SYSTEM SHALL reconcile the affected element in
  place (replacing the Phase-1 poll fallback) with a "graph updated" indicator — verified by an
  event-stream integration test.
- [ ] Coverage ≥ 80% (default, tunable) · mutation ≥ 70% (default, tunable) · 0 blocking bugs.
- [ ] **Measurable artefact delivered:** the multi-user convergence + latency test report at the
  default-5-concurrent tier, and the sync-room tenant-isolation test report.
- [ ] **Human sign-off recorded** (always the final exit criterion).

**HITL gates (configurable for this phase — declare which are active):**

| Gate | Active? | Approver | Blocks |
|------|---------|----------|--------|
| Spec-approval (PO/stakeholder sign-off) | **mandatory** | PO + EA stakeholder | phase start |
| Phase-boundary ceremony (security-review + mutation + doc-gen) | yes | PO + Tech lead | GA |
| Pre-AWS-deploy (full local pyramid + gates green → approve → dev-AWS smoke) | yes | Tech lead | deploy |
| Publish/generate (ontology publish / artefact release) | no (N/A — no new released artefact this phase) | — | — |

> The Phase-2 security-review weight is higher: a new network-facing CRDT sync server with tenant-scoped
> rooms and any sync-server credentials in **AWS Secrets Manager only** (never `.env`).

**Phase-gate metadata** (evaluated by the phase-gate Stop hook / `/goal` condition):

```text
phase: 2
gate_id: graph-explorer-gate-2
condition: all_exit_criteria_met
approver: PO + Tech lead
blocks: GA
```

### HITL gate summary

| Gate | After phase | Approval criteria | Approver |
|------|-------------|-------------------|----------|
| Spec-approval | Before each phase | PRD/tech-spec approved (mandatory, globally) | PO + EA stakeholder |
| Gate 1 (phase-boundary + pre-deploy + GE-CANVAS-1 publish) | Phase 1 | All Phase-1 EARS exit criteria met (incl. OQ-01 perf, cross-tenant isolation, GE-CANVAS-1 conformance) + coverage/mutation floors + human sign-off | PO + Tech lead |
| Gate 2 (phase-boundary + pre-deploy) | Phase 2 | All Phase-2 EARS exit criteria met (multi-user convergence, sync-room tenant isolation, CE-EVENT-1 live refresh) + floors + human sign-off | PO + Tech lead |

> All numeric thresholds above are "default X, tunable" per workspace/project. Cross-engine dependencies
> cite contract IDs from `../contracts.md`.

