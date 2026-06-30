---
type: PRD
title: Graph Explorer — Product Requirements Document
description: "Full product requirements for the Weave Graph Explorer: the visual canvas that makes the Constitution Engine's RDF/OWL graph navigable by everyone in the organisation, with the embeddable GE-CANVAS-1 component (force + C4 modes) and team-shared saved views."
tags: [graph-explorer, 02-prd, visualization, canvas, c4]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/graph-explorer/02-prd/prd.md
# --- provenance block (merged per frontmatter-schema.md) ---
source: hybrid # prototype-grounded + locked decisions digest + inter-engine contracts
confirmed_by: none # DRAFT until a human signs off
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# PRD: Graph Explorer

**Brief:** [brief.md](../01-brief/brief.md)
**Status:** Draft
**Phase:** MVP (single-user + async share) · realtime collaboration → Phase 2 (D1)
**Owner:** gazzwi86 · **Last Updated:** 2026-06-30

---

## 1. Product Context

### Background

The Constitution Engine (CE) holds a formal OWL/SHACL knowledge graph of how a company operates.
A knowledge graph in Turtle is unreadable to the business and operations staff who actually need
it. The Graph Explorer is the visual surface that makes that graph accessible: a force-directed
interactive canvas where users explore, navigate, filter, overlay, and (for authorised roles) edit
the operating model — without understanding RDF or SPARQL.

The Explorer ships alongside the Constitution Engine as part of the MVP. Without a visual layer the
CE stays an expert-only tool and company-wide adoption stalls. Together they close the "model the
business" half of the Weave loop.

The Explorer does **not** own the model. Every authoritative change made on the canvas is written
through the CE's validated-operations write API (`CE-WRITE-1`), which SHACL-validates on a throwaway
clone and only commits if there are no `sh:Violation`s. The Explorer owns *how the graph is seen and
worked on*; the CE owns *what the graph is and whether it is valid*. The authoritative authorisation
boundary is the CE write endpoint (JWT + role claim) — the Explorer's edit-handle visibility is UX
convenience only, never the security control (see §6 Security).

The Explorer also **owns and provides** the embeddable canvas component `GE-CANVAS-1` (modes
`force` | `c4`). The Build Engine embeds a project-scoped slice of it and writes project architecture
back via `CE-WRITE-1` (E3 / GE-CANVAS-1).

**Grounded from the working prototype** (`weave-prototype/frontend`, see citations inline):
- Cytoscape.js (prototype pins `^3.30.0`) with `cytoscape-fcose` is the primary force canvas
 library (`package.json`). The exact patch version is pinned by the architect at tech-spec.
- Spotlight selection (close neighbourhood full opacity, everything else dimmed), a semantic-zoom
 label threshold, drag-end position persistence to `localStorage` keyed by **projectId**
 (`CytoscapeGraph.tsx:18` `weave:layout:${projectId}`), `edgehandles` drag-connect with
 `hoverDelay:150`, `snap:false`, `preview:true`, self-loops blocked, edge-creation delegated
 upstream on `ehcomplete` (`CytoscapeGraph.tsx:188-205`), and an exact heatmap colour mapping
 (`CytoscapeGraph.tsx:43-51`) are proven patterns.
- The prototype differentiates node kinds by **colour only** (single ellipse shape, `cytoscape.ts:46-103`)
 and has a second React-Flow C4/"Model" canvas over the same graph; the Explorer now owns the C4
 mode as part of GE-CANVAS-1 (E3).

**Decisions applied (digest IDs):** D1 (realtime → Phase 2; MVP single-user + async share/comments),
D2 (server-side team-shared Saved Views + layout), D3 (server diff of two published versions via
`CE-DIFF-1`, incl. edge modifications), E3 (Explorer owns `GE-CANVAS-1`, modes `force|c4`; Build embeds
project slice), E4 (every threshold = "default X, tunable").

### Goals

1. Make the full company operating model visible and navigable to every role — no RDF or SPARQL
 required — reading from the CE versioned read interface (`CE-READ-1`).
2. Provide rich filtering and overlay (entity type, relationship type, heatmap, version diff, impact,
 domain colouring) so users focus on what matters.
3. Allow visual edits (add/edit/delete node, add edge) on the **draft** graph that commit safely
 through CE SHACL validation (`CE-WRITE-1`); published versions are read-only.
4. Provide team-shared, server-persisted Saved Views and layout (D2), plus **async sharing** of a
 view with comments (D1) — without realtime co-editing in the MVP.
5. Own and expose the embeddable `GE-CANVAS-1` canvas component (modes `force|c4`) consumed by the
 Build Engine for its project-ontology view (E3).
6. Visualise the CE's versioning: view any published version (read-only) and a server-computed diff
 between two published versions (`CE-DIFF-1`).

### Non-Goals

- **The model, store, ontology, SHACL validation, OWL reasoning** — owned by the Constitution Engine.
- **The versioning lifecycle** (draft → published, version IRIs, PROV-O) — owned by the CE; the
 Explorer visualises it via `CE-READ-1` / `CE-VERSION-1` / `CE-DIFF-1`.
- **Raw SPARQL query authoring** — provided by the CE Query screen. The Explorer's property filter
 builder is a visual filter over the loaded graph, not a query console (FR-013, §6).
- **The automation flow canvas** — owned by the Events & Actions Engine.
- **Project-level kanban / PM graph views** — owned by the Build Engine. (Build embeds the
 `GE-CANVAS-1` slice for its project-ontology view, but owns its own PM surfaces.)
- **Realtime multi-user co-editing, presence, cursors, follow-me** — **Phase 2** (D1), not MVP.
- **WebGL rendering** (sigma.js, G6) — not in v1; a tech-spec escape hatch if 10k-node targets are
 not met (OQ-01).

---

## 2. Personas & Roles

| Persona | Description | Primary need | Permission level |
|---|---|---|---|
| Operations / business staff | Understand the operating model, find their part of it | Visual navigable view, no RDF/SPARQL | viewer (read-only canvas) |
| Enterprise architect | Navigates, edits, assesses structure | Drill-in, impact/dependency, validated visual editing | BA (instance edits) / ontologist (structure edits) |
| Workshop facilitator / Weave consultant | Runs modelling sessions; in MVP, async (live co-edit is Phase 2) | Saved Views, async share + comments | BA + view-pin (admin) |
| Leadership / exec sponsor | High-level picture of how the company fits | Whole-company view at a glance, drill-in | viewer |
| Compliance / analyst | Reviews interconnections and model history | Dependency tracing, version views, diff overlay | viewer |

> Role slugs are the CE RBAC vocabulary (`CE-WRITE-1` enforces them server-side):
> **ontologist** = may write structure (new node *kinds* / relationship *types*); **BA** = may write
> *instances* (add/edit/delete individual nodes/edges); **viewer** = read-only. Workspace **admin**
> is a Platform RBAC role (`PLAT-SETTINGS-1`) used for Saved-View pin/delete governance, not for
> graph writes.

---

## 3. User Stories

### Epic 1: Whole-Company Canvas (force mode)

**E1-S1: View the whole company graph on load**
As any user, I want to open the Explorer and see the company's operating model as a force-directed
network so that I immediately grasp the whole business, not a list of records.
- **AC:** Given an authenticated user, when the Explorer opens, then nodes and edges of the
 **current draft** graph (default editable target — published versions are read-only, see E8) load via `CE-READ-1` and render in the Cytoscape canvas with fcose params
 `animate:true, animationDuration:600ms, nodeSeparation:90, idealEdgeLength:110,
 nodeRepulsion:6500, quality:'default', randomize:true` (`cytoscape.ts:105-114`; randomize/auto-layout
 runs only for nodes lacking saved positions).
- **AC:** Given the loaded graph, when rendered, then each node is coloured by its CE node-kind using
 the **BPMO framework** kind set + grey fallback served by CE (`/api/node-kinds` via `CE-READ-1`;
 client palette is fallback only). The palette **must cover every BPMO kind** with a grey fallback for
 any unrecognised/client-extension kind. `Process` is a first-class visible kind and takes a prominent
 hue. Reference palette: Process `#dc2626`, Activity `#f59e0b`, Event `#0ea5e9`,
 Actor `#0d9488`, Goal `#ca8a04`, Policy `#be185d`, BusinessDomain `#7c3aed`,
 BusinessCapability `#db2777`, System `#2563eb`, Service `#0891b2`, DataAsset `#16a34a`,
 Concept `#ea580c`, Field `#65a30d`, Class `#d97706`, fallback `#64748b`. Node **shape** is a single
 ellipse in v1 (prototype is colour-only, `cytoscape.ts:46-103`); a kind→shape and
 relationship-type→stroke mapping is a net-new design decision deferred to OQ-08.
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
- **AC:** Given the canvas, when the user scrolls/pinches, then the canvas zooms; when the user
 presses Cmd/Ctrl+0, then the canvas fits-to-screen.
- **AC:** Given semantic zoom (label threshold **default 0.55×, tunable per workspace**), when zoom
 < 0.55×, then edge labels hide; when ≥ 0.55×, edge labels show on hover; node labels show above
 **default 0.3×, tunable per workspace**.
- **AC:** Given the canvas, when rendered, then a mini-map (fixed bottom-right) shows viewport
 position relative to the full graph. The mini-map is **net-new** (no prototype) — built
 with `cytoscape-navigator` (or equivalent) named at tech spec.
- **AC (failure mode):** Given a Cmd+0 / Cmd+K binding collides with a browser shortcut, when pressed,
 then the canvas handler `preventDefault`s only when the canvas has focus; otherwise the browser
 default wins (no silent capture).
- **Priority:** Must Have

**E1-S3: Spotlight a node**
As any user, I want to click a node and see it and its neighbours highlighted while everything else
dims so I understand one entity's connections without noise.
- **AC:** Given a node, when clicked, then `closedNeighborhood` stays at full opacity and all other
 elements dim to **default 0.18 opacity, tunable per workspace** (prototype value).
- **AC:** Given a node is spotlighted, when the side panel opens, then it shows label, human-readable
 type (kind), and key property values from the CE. The raw **IRI is NOT shown** in the default
 business-user panel (model-hiding contract); it is revealed only under an "Advanced /
 technical details" disclosure for ontologist-role users.
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
- **AC (failure mode):** Given Cmd+K is reserved by the browser/OS, when the canvas lacks focus, then
 the binding does not fire (no global capture); the sidebar search field remains the fallback entry.
- **Priority:** Must Have

**E1-S5: Persist and reset layout (server-side, D2)**
As any user, I want node positions saved after I drag them and restored next visit so I don't
re-arrange every session.
- **AC:** Given a node is dragged, when drag ends, then its position is persisted **server-side**,
 scoped per **(tenant, project, graphId)** — replacing the prototype's per-browser
 `localStorage` key `weave:layout:${projectId}` (`CytoscapeGraph.tsx:18`). The store is an
 Explorer-owned Aurora table (not graph data; not an inter-engine contract). `localStorage` is a
 client cache only.
- **AC:** Given saved positions exist, when the canvas loads, then they are applied before fcose runs;
 fcose runs only for nodes lacking a saved position or when "Reset layout" is clicked.
- **AC (failure mode):** Given the layout-persistence API is unreachable on drag-end, when the write
 fails, then the position holds optimistically on canvas, a "layout not saved" toast appears, and the
 client retries with backoff; positions are never silently dropped.
- **Priority:** Must Have

---

### Epic 2: Drill-In & Domain Focus

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
- **AC (failure mode):** Given expansion would add > a configurable cap (**default 500 nodes, tunable
 per workspace**), when triggered, then a confirmation warns of the count before expanding.
- **Priority:** Should Have

**E2-S3: Impact / dependency trace **
As any user, I want to select a node and see everything upstream/downstream highlighted so I
understand cross-domain impact before changing anything.
- **AC:** Given a node, when right-click → "Show impact" (downstream) or "Show dependencies"
 (upstream), then traversal highlights the full chain. **Traversal direction predicates are fixed:**
 `dependsOn` (a depends on b ⇒ b is upstream of a); `realizes` and `servesGoal` count as
 upstream contributors; `inDomain`/`hasCapability` refs are membership, not dependency, and do NOT
 traverse. The exact closure of "depends-on" predicates is confirmed against the shipped BPMO
 relationship types and recorded as OQ-09.
- **AC:** Given traversal, when run, then it executes as a **CE SPARQL property-path SELECT** via
 `CE-READ-1` (paginated, SELECT-only, SERVICE blocked, no silent row cap — B3), with depth
 **default = all reachable, tunable, cap N hops (default 6)**. Highlight colour is a distinct amber
 overlay, separate from spotlight blue.
- **AC (failure mode):** Given the chain references nodes not currently loaded on canvas, when
 highlighted, then those nodes are auto-loaded (or a "N off-canvas dependencies" badge is shown if
 auto-load is capped); the trace never silently truncates without indicating it.
- **Priority:** Must Have

---

### Epic 3: Filters & Layers

**E3-S1: Toggle entity types on/off**
- **AC:** Given the Filters & Layers panel, when it opens, then it lists all entity types present with
 toggles; toggling off hides those nodes + edges and the layout re-flows; toggling on restores them
 with positions preserved.
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
- **AC (failure mode):** Given a property path absent on a node, when filtered, then that node is
 treated as non-matching (excluded), not errored.
- **Priority:** Should Have

**E3-S4: Show/hide governed content layers**
- **AC:** Given the panel, when governed-content toggles (Glossary concepts, Brand standards,
 Governance rules) are used, then those layers show/hide independently of entity-type toggles.
- **AC (failure mode):** Given a governed layer is empty for the current graph, when listed, then its
 toggle is shown disabled with a "no items" hint.
- **Priority:** Should Have

---

### Epic 4: Visual Overlays

**E4-S1: Heatmap overlay (fixed mappings)**
As an enterprise architect, I want a heatmap overlay on Capability nodes so I spot weak/underinvested
areas.
- **AC:** Given the heatmap selector (dimension: maturity / investment / strategy / lifecycle), when a
 dimension is chosen, then nodes colour by the **fixed prototype mapping** (`CytoscapeGraph.tsx:43-51`):
 maturity 1→5 = `#ef4444 / #f97316 / #eab308c55eb5cf6`; investment `High/Medium/Low/None`;
 strategy `Differentiation/Innovation/Commodity`; lifecycle `Plan / Phase In / Active / Phase Out /
 End of Life`. These EA fields are **free-text strings** (not store-enforced enums); unmatched values
 map to neutral grey.
- **AC:** Given a node with no value for the chosen dimension, when overlaid, then it shows neutral
 grey; a legend in the bottom corner maps colours to values; the heatmap can apply with a domain
 filter active.
- **AC (failure mode):** Given a free-text value outside the known vocabulary, when overlaid, then it
 maps to neutral grey and is counted in a "N unrecognised values" legend note (not dropped silently).
- **Priority:** Must Have

**E4-S2: Diff overlay between two published versions (D3 / CE-DIFF-1)**
As a compliance/analyst, I want a diff overlay between two published versions so I see what changed.
- **AC:** Given the version picker (version A vs version B, both published), when applied, then the
 Explorer calls **`CE-DIFF-1`** (`GET /api/ontology/diff?from=<vA>&to=<vB>`) and renders: added
 nodes/edges = green border; removed = red border at **default 0.35 opacity, tunable**; modified
 nodes **and edges** = amber border. Edge modification is **in scope** (server-side diff includes
 edge mods, D3 — this supersedes the prototype's client diff which marked edges add/remove only).
- **AC:** Given a modified element, when clicked, then a before/after property diff is shown from the
 `CE-DIFF-1` `modified[].before/after` payload; a summary panel lists added/removed/modified counts.
- **AC (failure mode):** Given `CE-DIFF-1` returns 4xx/5xx or the two versions are identical, when
 applied, then the overlay shows "no differences" (identical) or a retryable error banner (failure);
 the base canvas is never left in a half-diffed state.
- **Priority:** Must Have

**E4-S3: Impact highlight overlay**
- **AC:** Given an impact trace (E2-S3), when "Pin impact view" is on, then the highlight persists
 through pan/zoom; it is clearable from the sidebar or by right-clicking the source node.
- **AC (failure mode):** Given the source node is deleted while pinned, when detected, then the overlay
 auto-clears with a "source removed" notice.
- **Priority:** Must Have

**E4-S4: Domain colouring layer**
- **AC:** Given domain colouring, when on, then each domain gets a consistent hue applied to member
 node border/background; domain colouring and type colouring are mutually exclusive in v1.
- **AC (failure mode):** Given more domains than the palette has distinct hues (**default 12, tunable**),
 when applied, then hues cycle with a legend disambiguating, rather than silently colliding.
- **Priority:** Should Have

---

### Epic 5: Visual Editing on the Canvas (commits via CE-WRITE-1)

> All authoritative writes in this epic go through **`CE-WRITE-1`** (`POST /api/operations/apply`,
> the CE's sole validated mutation entry point — the prototype's legacy auto-apply `/api/llm/mutate`
> is explicitly NOT used). The Explorer never writes triples directly. Authorisation is enforced
> **server-side** at `CE-WRITE-1` (JWT + CE role claim); edit-handle visibility on the canvas is UX
> only (#4, #8). Editing targets the **draft** graph; published versions are read-only
>. The `CE-WRITE-1` `actor` for a **human** visual edit is the editing user's Cognito
> identity (carried in the JWT); `PLAT-IDENTITY-1` mints principals for **agent**-initiated writes
> only (e.g. an automation embedding the canvas), not for direct human edits. Whether human edits
> also receive a registry-minted principal IRI is OQ-11.

**E5-S1: Add a node by double-clicking the canvas**
As an enterprise architect (BA role), I want to double-click empty canvas to quick-add an entity.
- **AC:** Given empty canvas, when double-clicked, then a popover opens with a kind selector + label;
 on confirm, an `add_node` op is sent via `CE-WRITE-1`. On `201`, the node renders and its position
 is persisted (E1-S5). On `422 { violations }`, the popover shows the human-readable SHACL violation
 messages.
- **AC (failure mode — optimistic rollback):** Given `CE-WRITE-1` is unreachable or times
 out (default 10 s, tunable) after an optimistic node is shown, when the call fails, then the
 optimistic node is rolled back, an error toast appears, and no orphan stays on canvas.
- **Priority:** Must Have

**E5-S2: Draw an edge by drag-connecting two nodes**
As an enterprise architect (BA role), I want to drag from a source node's handle to a target to create
a relationship.
- **AC:** Given a hovered node, when the edge-handle appears, then `edgehandles` config matches the
 prototype: `hoverDelay:150ms, snap:false, preview:true, self-loops blocked (canConnect source≠target)`
 (`CytoscapeGraph.tsx:188-205`). **Handle colour/size are library defaults** in v1 (the
 "purple #7c3aed 12×12px" claim is removed as fabricated); a styled handle is OQ-08.
- **AC:** Given a drag to a target, when `ehcomplete` fires, then a relationship-type picker opens; on
 confirm, an `add_edge` op is sent via `CE-WRITE-1`. On `201` the edge renders; on `422` the picker
 shows the violation.
- **AC (failure mode):** Given the write fails/times out, when detected, then the optimistic edge is
 rolled back and an error toast shown.
- **Priority:** Must Have

**E5-S3: Edit a node's label or properties from the side panel**
As an enterprise architect (BA role), I want to edit a node's label/properties in-place.
- **AC:** Given the side panel, when an editable field (`rdfs:label`, `rdfs:comment`, typed properties
 of the node's OWL class) is saved, then an `update_node` op is sent via `CE-WRITE-1`; on `201` the
 change commits and the CE writes a PROV-O activity + `PLAT-AUDIT-1` entry (attributed to the
 editing user's Cognito identity for human edits; a `PLAT-IDENTITY-1` principal for
 agent-initiated edits — OQ-11). On `422` the field shows the violation.
- **AC (failure mode — concurrent edit):** Given two authorised users edit the same
 property at near-same time (in MVP via separate single-user sessions), when both submit, then writes
 serialise at `CE-WRITE-1`; resolution policy is **last-writer-wins with version check** — the second
 write is accepted if the node version is unchanged, else rejected `409` and the user is notified to
 reload. (Realtime co-edit/CRDT merge is Phase 2, D1.)
- **Priority:** Must Have

**E5-S4: Delete a node or edge**
As an enterprise architect (BA role), I want to delete a node/edge.
- **AC:** Given a node with incoming references, when delete is invoked, then a warning lists affected
 relationships before commit; delete requires explicit confirmation (never instant).
- **AC:** Given confirmation, when committed, then a `delete_node`/`delete_edge` op is sent via
 `CE-WRITE-1`; the CE's delete cleans up reification/annotation statements server-side, and the
 **cascaded removal of those annotated edges/statements is reflected on the canvas** after the write
 returns — the canvas re-reconciles from the CE response, it does not assume only the
 selected element was removed.
- **AC (failure mode):** Given the delete fails/times out, when detected, then nothing is removed from
 canvas and an error toast is shown (no optimistic delete of a node that may still exist server-side).
- **Priority:** Must Have

---

### Epic 6: Async Share & Comments (MVP) — realtime collaboration is Phase 2 (D1)

> **D1:** Realtime multi-user co-editing, live presence, cursors, and follow-me are **Phase 2**
> (Yjs/CRDT, sync transport, scaling). The MVP collaboration model is **single-user editing + async
> sharing**: a user shares a Saved View, others open it asynchronously and leave comments. This epic
> replaces the former realtime Epic 6; the realtime stories are preserved as Phase 2 below.

**E6-S1: Share a Saved View asynchronously**
As any user, I want to share a Saved View with named workspace colleagues so they can open the same
lens later.
- **AC:** Given a Saved View (E7), when "Share" is used, then selected workspace members get an in-app
 notification via **`PLAT-NOTIFY-1`** ("X shared a view with you", deep-link to the view); delivery is
 in-app (+ Slack if the recipient opted in). Sharing is scoped to the same tenant/workspace.
- **AC (failure mode):** Given a recipient lacks viewer access to the underlying graph, when the share
 is sent, then they receive no notification and the sharer sees "N recipients lack access" (no
 cross-tenant or unauthorised leak).
- **Priority:** Must Have · **Phase / depends-on:** MVP, depends-on PLAT-NOTIFY-1

**E6-S2: Comment on a node or a Saved View**
As any user, I want to leave a comment on a node or a shared view so we can discuss the model
asynchronously.
- **AC:** Given a node or Saved View, when a comment is added, then it persists **server-side** in an
 Explorer-owned Aurora table (tenant + workspace scoped; not graph data, not an inter-engine
 contract), with author, timestamp, and target (node IRI or view id), and is visible to workspace
 members on that target.
- **AC (failure mode):** Given the comment write fails, when submitted, then the draft comment text is
 preserved client-side with a retry control; comments are never silently lost.
- **Priority:** Must Have · **Phase / depends-on:** MVP

**E6-S3: Live refresh on upstream graph change (Should Have, degrade to poll)**
As any user, I want the canvas to reflect a change another user committed without a manual reload.
- **AC:** Given the Explorer is subscribed to **`CE-EVENT-1`** for the current graph, when CE emits a
 change event (`added/updated/deleted/constraint-violated`), then the affected element is
 reconciled in place and a subtle "graph updated" indicator shows.
- **AC (failure mode / degradation):** Given the `CE-EVENT-1` stream is unavailable, when subscribing
 fails, then the Explorer **degrades to polling `CE-READ-1`** with a since-version cursor at a
 **default 30 s interval, tunable per workspace**; the user is not blocked.
- **Priority:** Should Have · **Phase / depends-on:** MVP for poll fallback; live stream when CE-EVENT-1 ships

**E6-S4 (Phase 2): Realtime co-editing, presence, cursors**
As a workshop facilitator, I want multiple users live on the same canvas with cursors and presence.
- **AC:** Given a live session, when ≥ 2 users are active (target **default 5 concurrent, tunable**),
 then each sees others' cursors (name/initials), independent viewports, and node drags reflected with
 **default ≤ 500 ms p95 latency, tunable** (LAN/good broadband); CRDT (Yjs) merges ephemeral canvas/
 presence state while authoritative writes still serialise through `CE-WRITE-1`.
- **AC (security):** Given a CRDT sync room, when a client connects, then the sync server validates the
 Cognito JWT tenant claim against the room id (room id includes the tenant id); a mismatched tenant is
 rejected at connect — client-side gating is never the boundary.
- **AC (failure mode):** Given the sync transport drops mid-session, when reconnecting, then local
 edits replay and converge with no lost updates; duplicate-IRI creates reconcile at `CE-WRITE-1`.
- **Priority:** Won't Have (MVP) / Must Have (Phase 2) · **Phase / depends-on:** Phase 2; OQ-02/OQ-07

**E6-S5 (Phase 2): Workshop "Follow me" mode**
As a facilitator, I want followers' viewports to follow mine.
- **AC:** Given follow-me on, when followers join, then their pan/zoom sync to the facilitator (a
 banner indicates following) and follow only viewport, not selection/editing; followers break out by
 panning/zooming.
- **Priority:** Won't Have (MVP) / Should Have (Phase 2) · **Phase / depends-on:** Phase 2; OQ-07

---

### Epic 7: Saved Views & Layout (server-side, team-shared — D2)

**E7-S1: Save current canvas state as a named view**
As any user, I want to save my canvas state with a name so I reopen it without re-configuring.
- **AC:** Given the canvas, when "Save view" is used, then it captures active filters, active overlays,
 domain focus, viewport (pan/zoom), and the **server-side layout positions** for that view (D2 — not
 read from per-browser `localStorage`, resolving the positions/shared-view contradiction);
 a name is required, description optional. Persisted in an Explorer-owned Aurora table scoped by
 (tenant, workspace).
- **AC (failure mode):** Given a name collision in the workspace, when saving, then the user is
 prompted to overwrite or rename (no silent clobber).
- **Priority:** Must Have

**E7-S2: Workspace-shared view library**
- **AC:** Given Saved Views, when the panel opens, then it lists all views in the workspace with
 creator and last-updated; any workspace member can open; a creator can delete their own; a
 **workspace admin** (`PLAT-SETTINGS-1` RBAC) can delete any.
- **AC (failure mode):** Given a view references entities deleted since it was saved, when opened, then
 it loads what still exists and flags "N items in this view no longer exist".
- **Priority:** Must Have

**E7-S3: Featured (pinned) views**
- **AC:** Given the library, when a workspace admin pins a view, then up to **default 5 pinned,
 tunable per workspace** appear in a "Featured" section at the top.
- **AC (failure mode):** Given the pin limit is reached, when another pin is attempted, then the admin
 is prompted to unpin one first (no silent overflow).
- **Priority:** Should Have

---

### Epic 8: Version Views & Diff (visualises CE versioning)

**E8-S1: View a specific published version (read-only)**
As a compliance/analyst, I want to view the canvas in a historical published state to audit it.
- **AC:** Given the Versions & Diff panel, when it opens, then it lists published versions (timestamp +
 semver) from **`CE-VERSION-1`** (`GET /api/ontology/versions`). Selecting a version loads that
 version's graph via `CE-READ-1` (`?version=<iri>`, paginated, no silent cap — B3) **read-only**;
 editing is disabled and a banner indicates "viewing historical version, not the current draft".
- **AC:** Given the default load, when no version is selected, then the canvas shows the **current
 draft** (editable for authorised roles); `version=latest` resolves to the newest published version
 for read-only viewing (B2) — the draft and "latest published" are distinct targets.
- **AC (failure mode — scale):** Given a version graph exceeds one page, when loaded, then
 the Explorer pages through `CE-READ-1` (no 500-row cap exists post-B3); if total retrieval exceeds a
 **default 10,000-node soft ceiling (tunable)**, then a "large historical graph" banner + incremental
 load is shown. A dedicated CE bulk/CONSTRUCT graph-export endpoint for whole-version retrieval is
 OQ-03 (owner: CE/Architect).
- **Priority:** Must Have

**E8-S2: Visual diff between two published versions**
As a compliance/analyst, I want to diff any two published versions from the panel.
- **AC:** Given the panel, when "Compare versions (A vs B)" is used, then the diff overlay (E4-S2 via
 `CE-DIFF-1`, server-computed incl. edge mods) renders on the canvas and a summary is exportable.
- **AC (failure mode):** Given export is requested, then a JSON entity-summary is produced in v1
 (PDF/CSV deferred — OQ-06); if export fails, the on-screen summary remains available.
- **Priority:** Must Have

---

### Epic 9: Embeddable Canvas Component — GE-CANVAS-1 (E3, this engine PROVIDES)

**E9-S1: Provide the parameterised embeddable canvas**
As the Build Engine, I want to embed the Explorer's canvas scoped to a project so I show a project's
architecture without rebuilding a viewer.
- **AC:** Given a host (Build), when it mounts `GE-CANVAS-1` with props
 `{ source, filterByIri, mode: "force"|"c4", readonly, version }`, then the component renders the
 matching slice: `filterByIri = <project IRI>` scopes to entities tagged with that project; `mode`
 selects force-directed or the structured **C4** view (resolves the dual-canvas scope gap — C4 mode is IN, owned by Explorer); `readonly` disables editing; `version` pins the read.
- **AC:** Given Build makes a project-architecture edit through the embedded canvas, when committed,
 then the write goes back through **`CE-WRITE-1`** (Explorer owns the component; Build manages its
 project portion — bidirectional sync per the contract).
- **AC (failure mode):** Given `filterByIri` matches no entities, when mounted, then the component
 renders an empty-state, not an error; given `mode:"c4"` with no structural data, it falls back to a
 "no C4 structure modelled" state.
- **Priority:** Must Have · **Phase / depends-on:** MVP for `force` mode + embedding; `c4` mode P0 within MVP

---

## 4. Functional Requirements

> "Phase / depends-on" ties each FR to a delivery phase and any engine/contract it cannot ship
> before. Every FR has a Given/When/Then AC + a failure-mode AC in §3.

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

---

## 5. Inter-engine Interfaces

> Reference contracts by ID from `docs/specs/_inter-engine-contracts.md`. Consumed contracts are
> version-pinned (downstream auto-tracks `latest` unless pinned — B2/CE-VERSION-1).

### Consumed (this engine calls / reads)

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

### Provided (this engine exposes to others)

| Contract | Consumers | Shape (link) | Stability |
|---|---|---|---|
| `GE-CANVAS-1` — embeddable canvas component, props `{ source, filterByIri, mode:"force"\|"c4", readonly, version }` | Build Engine (embeds project-scoped slice; writes back via `CE-WRITE-1`) | [_inter-engine-contracts.md §3](../../_inter-engine-contracts.md) | beta (force MVP; c4 MVP) |

> Saved Views, server-side layout positions, and comments are **Explorer-internal** (Aurora tables,
> tenant/workspace-scoped). They are intentionally NOT inter-engine contracts and carry no contract ID.

---

## 6. Non-Functional Requirements

### Performance

- Canvas initial load: **default ≤ 3 s at 1k nodes, ≤ 8 s at 10k nodes** (p95, desktop Chrome/Safari,
 modern hardware). These are **unverified targets pending the OQ-01 benchmark** (#25) —
 not prototype-proven; tunable.
- Node drag: **default ≤ 16 ms (60 fps)** at ≤ 1,000 visible nodes (single-user); tunable target.
- Filter/overlay apply: **default ≤ 300 ms** at up to 10k nodes; tunable target.
- (Phase 2) Collaborative cursor sync: **default ≤ 500 ms p95** at default 5 concurrent users; tunable.
- fps/latency targets are a single tiered table validated by the OQ-01 harness (browser, hardware,
 node/edge count, fps sampling method all defined there); the 60 fps@1k and any @5k figures are tiers
 of one model, not conflicting claims.

### Scalability

- v1 target: up to **default 10,000 nodes / 30,000 edges** (tunable) with Cytoscape + fcose. Viewport
 culling and lazy loading are **required net-new capabilities the architect must design and benchmark**
 (no prototype implementation), gated to OQ-01; a WebGL renderer (sigma.js/G6) is
 the escape hatch if Cytoscape cannot meet targets (OQ-05).

### Security

- All CE calls require a Cognito JWT. The **authoritative edit-authorisation boundary is `CE-WRITE-1`
 server-side (JWT + CE role claim)** — the Explorer's edit-handle visibility is UX only and is never
 the security control (#8). Role mapping: **ontologist** writes structure (node kinds /
 relationship types), **BA** writes instances, **viewer** is read-only.
- Historical published-version views are always read-only; the edit UI is disabled.
- Secrets (e.g. any sync-server credentials in Phase 2) live in **AWS Secrets Manager only** — never in
 `.env` or source.
- (Phase 2) CRDT sync-room id includes the tenant id; the sync server validates the JWT tenant claim
 against the room on connect and rejects a mismatch.
- Input validation at boundaries: filter values, comment text, and view names are sanitised
 client-side and re-validated server-side (Explorer Aurora writes use parameterised queries; no string
 concatenation into SQL — project security rule).

### Reliability

- Edit flows are optimistic with rollback on `CE-WRITE-1` error/timeout (default 10 s, tunable):
 add/edge/delete never leave an orphan or a phantom-removed element on canvas.
- Live refresh degrades from `CE-EVENT-1` stream to polling `CE-READ-1` (default 30 s) without blocking
 the user.
- Layout/view/comment writes retry with backoff; never silently dropped.

### Observability

- OTel spans for: graph load (`ce.read` attrs `version`, `node_count`), edit commit
 (`ce.write` attrs `op_type`, `result`, `actor_principal`), diff (`ce.diff` attrs `from`, `to`),
 traversal (`ce.sparql.path` attrs `depth`, `hops`). Errors correlate by request id; the
 `PLAT-AUDIT-1` `seq` of each committed edit is logged for cross-reference.

### Accessibility

- Side panel, search overlay, filter sidebar, comments: **WCAG 2.1 AA**, keyboard-navigable, ARIA-labelled.
- Canvas interactions (pan/zoom/spotlight) have keyboard equivalents and are screen-reader labelled;
 the force canvas need not be fully SR-navigable in v1 but must not trap keyboard focus.
- The accessibility gate is **zero axe-core violations** on the non-canvas UI in CI.

### Isolation & data safety

- **Multi-tenant isolation mechanism:** all CE reads/writes are tenant-scoped via the CE's
 named-graph + query-rewriting that **rejects any unscoped query** (resolve-by-default #6; final
 store-per-tenant vs named-graph mechanism is a CE/Platform tech-spec OQ but the expectation and test
 are stated here). Explorer-owned Aurora tables (views, layout, comments) carry a `tenant_id` +
 `workspace_id` on every row, filtered by the resolved `PLAT-SETTINGS-1` scope.
- **Cross-tenant-read test (required):** Given a tenant-A JWT, when any Explorer read (graph load,
 Saved View list, comment fetch, diff) is issued, then **zero tenant-B rows/triples** are returned;
 an attempt to address a tenant-B view id or room (Phase 2) is rejected.

### Browser / device support

- Chrome, Firefox, Safari — latest 2 major versions. Desktop-first; no mobile/tablet optimisation in v1.

---

## 7. Key Design Decisions Captured

| Decision | Rationale |
|---|---|
| Realtime collaboration is **Phase 2**; MVP = single-user editing + async share + comments (D1) | The strongest prototype evidence sequences realtime multi-party collab as the costliest, identity/hosting-dependent capability (`contribution-model.md`). MVP value lands without it. |
| Cytoscape.js (prototype `^3.30.0`; patch pinned at tech spec) + fcose for v1 force mode; 10k-node performance is a **target to validate (OQ-01)**, WebGL escape hatch (OQ-05) | Proven force patterns in prototype; 10k+culling is unproven and must not be asserted as settled (#25). |
| All authoritative writes go through **`CE-WRITE-1`** (`POST /api/operations/apply`); legacy `/api/llm/mutate` not used | The CE's sole validated mutation entry point (SHACL on throwaway clone, PROV-O attribution); replaces the previously-"invented" endpoint wording (cross-spec seam). |
| Server diff via **`CE-DIFF-1`**, incl. **edge modifications** (D3) | Server-side diff between two published versions; supersedes the prototype's client-side live-vs-snapshot diff that never marked edges modified (#3). |
| Saved Views, layout, comments are **server-side, team-shared, Explorer-owned Aurora** (D2) | Resolves the per-browser-localStorage vs team-shared contradiction (#11); positions for a shared view are persisted with the view. Not graph data → no inter-engine contract. |
| Explorer **owns `GE-CANVAS-1`** (modes `force\|c4`); Build embeds the project slice (E3) | Resolves the dual-canvas scope gap; the C4/structured canvas is IN and owned here; Build reuses rather than rebuilding (cross-spec seam). |
| Edit authz is **server-side at `CE-WRITE-1`**; canvas handle-hiding is UX only; CE role slugs (ontologist/BA/viewer) | Client gating is not a security control; aligns role vocabulary to CE (#8). |
| Heatmap uses the **fixed prototype value→colour mappings**; EA dimension fields are free-text strings | Removes the unfalsifiable "auto-derived" scheme; matches the data model. |
| Default editable target = **draft** graph; published versions read-only; `latest` = newest published (B2) | You cannot edit an immutable published version; disambiguates load target vs edit target. |
| Raw IRI hidden from business-user side panel (advanced disclosure for ontologists) | Upholds the model-hiding contract that is the product's reason to exist. |
| Property filter builder is **client-side visual filtering**, not a query | Keeps the CE Query screen as the sole query-authoring surface. |

---

## 8. Open Questions (for Tech Spec)

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

---

## 9. Acceptance Criteria (PRD-level)

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
- [ ] Cross-tenant isolation test passes: a tenant-A JWT returns zero tenant-B rows/triples across
 graph load, Saved Views, comments, and diff.
- [ ] At the (unverified, OQ-01) 5,000-node tier, the canvas loads within the agreed target and stays
 interactive at the agreed fps — or OQ-01 has triggered the WebGL escape hatch (OQ-05).

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Cytoscape cannot hit 10k-node targets | High | Med | OQ-01 benchmark early; WebGL escape hatch (OQ-05); culling/lazy-load (OQ-04) |
| Realtime collab (Phase 2) underestimated | High | Med | D1 defers it out of MVP; cost warning surfaced; budget at Phase 2 tech spec |
| `CE-WRITE-1` / `CE-DIFF-1` shapes shift during CE tech spec | Med | Med | Contracts are version-stable IDs; consume by ID, pin versions; integration tests against CE stubs |
| Server-side layout/views scope (D2) adds net-new Aurora schema not in prototype | Med | High | Explorer-owned table; tenant/workspace scoped; covered by isolation test |
| C4 mode (E3/GE-CANVAS-1) is net-new (prototype React-Flow canvas not productionised) | Med | High | Own epic (E9); architect budgets c4 mode distinctly from force mode |
| Impact traversal predicate semantics wrong (OQ-09) | Med | Med | Fix predicate closure with CE before build; testable example graph in AC |

---

## Related

- [Brief](../01-brief/brief.md)
- [Inter-engine contracts](../../_inter-engine-contracts.md)
- [Constitution Engine PRD](../../constitution-engine/02-prd/prd.md) — upstream provider (CE-READ-1, CE-WRITE-1, CE-DIFF-1, CE-VERSION-1, CE-EVENT-1)
- [Weave Platform Brief](../../weave-platform/01-brief/brief.md) — PLAT-NOTIFY-1, PLAT-SETTINGS-1, PLAT-IDENTITY-1, PLAT-AUDIT-1
- [Build Engine PRD](../../build-engine/02-prd/prd.md) — consumer of GE-CANVAS-1

---
*Generated by Weave PO agent. Review and approve before proceeding to Roadmap.*
