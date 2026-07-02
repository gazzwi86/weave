---
type: Task Brief
title: "Task: TASK-002 — Whole-Company Force Canvas + Navigation"
description: "Render the draft graph via CE-READ-1 as a Cytoscape.js + fcose force canvas with BPMO
  kind colouring, pan/zoom/mini-map, and semantic zoom; no raw IRIs exposed."
tags: [graph-explorer, arch, task, m1]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-001
milestone: M1
created: 2026-07-01
blocked_by: [TASK-001]
unlocks: [TASK-003, TASK-004, TASK-005]
adr_refs: [ADR-001-render-engine]
timestamp: 2026-07-01T00:00:00Z
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: e6499f88873d7157bed76c3632ce25e2f5fb6d4b
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
---

# Task: TASK-002 — Whole-Company Force Canvas + Navigation

## Story

**Epic:** [EPIC-001](../../../graph-explorer.md#epic-001--whole-company-canvas-force-mode--m1)
**Status:** Backlog
**Priority:** Must Have

**As a** viewer (operations staff, leadership, compliance, or enterprise architect)
**I want** to open the Graph Explorer and see the whole-company draft graph rendered as an interactive
force-directed canvas with colour-coded node kinds, pan/zoom, mini-map, and semantic zoom
**So that** I can understand the company operating model at a glance and navigate it without writing
SPARQL or seeing a raw IRI.

Covers: FR-001, FR-002, FR-003, FR-004, FR-005 from
[graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN an authenticated viewer opens the Explorer, THE SYSTEM SHALL call CE-READ-1 `GET /api/sparql?version=latest&page=N` (paginated until `has_more_pages` is false) and render all returned nodes and edges in a Cytoscape.js + fcose force canvas; fcose SHALL only randomise positions for nodes that have no saved layout position from TASK-004. | `test_canvas_loads_draft_graph_via_ce_read_1` |
| AC-2 | WHEN CE-READ-1 returns an error or times out (default 10 s, tunable), THE SYSTEM SHALL render an empty-state with the CE error message and a retry button; zero nodes or edges SHALL appear (no partial render). | `test_canvas_shows_empty_state_on_ce_error` |
| AC-3 | WHEN the canvas renders, THE SYSTEM SHALL colour each node using the palette from CE-READ-1 `GET /api/node-kinds`; any node with an unrecognised or extension `bpmo_kind` SHALL render as `#9CA3AF` (grey); the `Process` kind SHALL use a distinct prominent hue from the palette. | `test_node_colours_match_ce_palette`, `test_unknown_kind_renders_grey` |
| AC-4 | WHEN the user scrolls (mouse wheel) or pinches (trackpad), THE SYSTEM SHALL zoom the canvas in or out; WHEN the user presses Cmd/Ctrl+0, THE SYSTEM SHALL fit the full graph to the viewport. | `test_scroll_zoom`, `test_cmd_0_fit_to_screen` |
| AC-5 | WHEN the canvas renders, THE SYSTEM SHALL display a mini-map in the bottom-right corner that tracks the current viewport position within the full graph. | `test_minimap_renders_bottom_right` |
| AC-6 | WHEN the canvas zoom level drops below the node-label threshold (default 0.3×, tunable), THE SYSTEM SHALL hide node labels; above the threshold, labels SHALL be visible. WHEN zoom is above the edge-label threshold (default 0.55×, tunable), edge labels SHALL be visible on hover; below, they SHALL be hidden. | `test_semantic_zoom_node_labels_hide_below_threshold`, `test_semantic_zoom_edge_labels` |
| AC-7 | WHEN the canvas has keyboard focus AND the user presses Cmd/Ctrl+0 or Cmd/Ctrl+K, THE SYSTEM SHALL handle those bindings; WHEN the canvas does NOT have focus, THE SYSTEM SHALL NOT prevent the default browser or page-level behaviour. | `test_key_binding_no_global_capture` |
| AC-8 | WHEN the OQ-01 SPIKE (TASK-001 AC-2) has passed, THE SYSTEM SHALL complete first interactive render within the thresholds confirmed by the OQ-01 benchmark report (default ≤ 3 s at 1k nodes / ≤ 8 s at 10k nodes, p95, tunable) on reference hardware (desktop Chrome latest). This AC is suspended until TASK-001 is signed off. | `test_canvas_load_performance_p95_1k`, `test_canvas_load_performance_p95_10k` |
| AC-9 | WHEN any Explorer graph-load call is issued under a tenant-A JWT, THE SYSTEM SHALL receive zero tenant-B nodes or edges; the CE-READ-1 SPARQL query SHALL carry the Cognito JWT and no additional `graph=` override that could escape tenant scoping. | `test_cross_tenant_graph_load_isolation` |

## Implementation

### Pseudocode

```
# ExplorerCanvas — Next.js 15 client component (TypeScript strict)

function ExplorerCanvas({ workspaceId: string }):
  jwt = getCognitoJwt()           # from Next-Auth session; never stored client-side
  if not jwt: redirect("/login")  # middleware handles; belt-and-suspenders check

  onMount:
    setLoadState("loading")
    try:
      [palette, elements] = await Promise.all([
        fetchPalette(jwt),
        fetchGraph(jwt, workspaceId),
      ])
    catch CeReadError as err:
      setLoadState("error", err.message)
      return  # render empty-state; Cytoscape NOT initialised (no partial render)

    cy = Cytoscape({
      container: canvasRef.current,
      elements: elements,
      style: buildStylesheet(palette, config),  # kind→colour from palette; grey fallback
      userPanningEnabled: true,
      userZoomingEnabled: true,
    })
    cy.layout({ name: "fcose", ...config.fcose_params }).run()  # params from prototype-findings.md
    cy.on("viewport", throttle(updateMinimap, 16))  # rAF-throttled; no layout thrash
    registerKeyBindings(cy, config)
    setLoadState("ready")


function fetchPalette(jwt: string):
  resp = await fetch("/api/proxy/node-kinds",   # Next.js API route → CE-READ-1
    { headers: { Authorization: "Bearer " + jwt } })
  if resp.status == 401: throw CeReadError("unauthorised")
  if not resp.ok: throw CeReadError(`CE error ${resp.status}`)
  return (await resp.json()).kinds           # [{ id, label, colour }]

function fetchGraph(jwt: string, workspaceId: string):
  elements = []
  page = 0
  deadline = Date.now() + config.ce_timeout_ms  # default 10_000, tunable
  loop:
    if Date.now() > deadline: throw CeReadError("timeout after 10s")
    resp = await fetch(`/api/proxy/sparql?version=latest&page=${page}`,
      { headers: { Authorization: "Bearer " + jwt } })
    if resp.status == 401: throw CeReadError("unauthorised")
    if not resp.ok: throw CeReadError(`CE error ${resp.status}`)
    data = await resp.json()
    elements.push(...mapRowsToElements(data.rows))
    if not data.has_more_pages: break
    page++
  return elements

function mapRowsToElements(rows):
  # rows = [{ subject, predicate, object, bpmo_kind?, label?, skos_pref_label? }]
  # Deduplicate nodes; build edge specs for triple rows
  # Returns Cytoscape ElementDefinition[]

function buildStylesheet(palette, config):
  kindStyles = palette.map(k => ({
    selector: `node[bpmo_kind="${k.id}"]`,
    style: { "background-color": k.colour },
  }))
  return [
    { selector: "node",
      style: {
        label: "data(label)",
        "font-size": 12,
        shape: "ellipse",        # single shape in M1; kind→shape deferred (OQ-08)
        "background-color": "#9CA3AF",  # fallback for unrecognised kinds
      }
    },
    ...kindStyles,
    # Semantic zoom — handled via cy.on("zoom") event (not CSS), updating element style
    { selector: "edge", style: { label: "", "curve-style": "bezier" } },
  ]

function registerKeyBindings(cy, config):
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    # Guard: only fire when canvas container holds focus
    if not cy.container().contains(document.activeElement): return
    if (e.metaKey || e.ctrlKey) AND e.key == "0":
      e.preventDefault()
      cy.fit()
    # Cmd+K delegated to SearchOverlay component via its own focused listener
  })

  cy.on("zoom", () => {
    z = cy.zoom()
    if z < config.node_label_threshold:   # default 0.3, tunable
      cy.nodes().style({ "text-opacity": 0 })
    else:
      cy.nodes().style({ "text-opacity": 1 })
    if z < config.edge_label_threshold:   # default 0.55, tunable
      cy.edges().style({ "text-opacity": 0 })
    else:
      cy.edges().style({ "text-opacity": 1 })
  })

# Error state (render path)
if loadState == "error":
  render <EmptyState message={errorMessage} onRetry={retryLoad} />
  # Canvas div is not mounted; Cytoscape never initialises
```

### API Contracts

This task calls CE-READ-1. The Explorer does not expose its own API endpoints in this task.

CE-READ-1 contracts consumed (shapes from [contracts.md](../../../../contracts.md)):

**`GET /api/node-kinds`** (CE-READ-1)

Response `200`:

```json
{
  "kinds": [
    { "id": "Process",      "label": "Process",      "colour": "#3B82F6" },
    { "id": "DataAsset",    "label": "Data Asset",   "colour": "#10B981" }
  ]
}
```

Error responses:

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` |
| 503 | CE unavailable | `{"error": "store_unavailable"}` |

**`GET /api/sparql?version=latest&page={n}`** (CE-READ-1 SELECT-only, paginated)

Response `200`:

```json
{
  "rows": [
    { "subject": "https://…", "predicate": "https://…", "object": "https://…",
      "bpmo_kind": "Process", "label": "Customer Onboarding" }
  ],
  "columns": ["subject", "predicate", "object", "bpmo_kind", "label"],
  "has_more_pages": true,
  "page": 0
}
```

Error responses:

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` |
| 503 | CE store unavailable | `{"error": "store_unavailable"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|------------------|---------|
| Sequence | `../../tech-spec/business-process.md` | `#canvas-initial-load` | Full canvas boot: palette + saved positions + paginated CE-READ-1 load |
| State | `../../tech-spec/business-process.md` | `#canvas-load-state` | Load state machine (loading → rendered / CE-error empty-state) |
| Data Model | `../../tech-spec/data-model.md` | `#bpmo-node-kinds` | 13 BPMO kinds + grey fallback the palette colours nodes by |
| Component | `../../tech-spec/architecture.md` | `#level-3-component--spa-canvas-module` | SPA Canvas Module boundary and renderer-adapter seam |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|---------------------|
| Cytoscape.js + fcose for force layout (prototype-proven); performance at 10k gated on TASK-001 SPIKE (SS-GE-1) | [graph-explorer.md §2.5](../../../graph-explorer.md#25-key-design-decisions) | Use fcose with prototype params verbatim; AC-8 suspended until TASK-001 AC-2 signed off |
| Node shape = single ellipse in M1; kind→shape mapping deferred (OQ-08) | [graph-explorer.md §2.5](../../../graph-explorer.md#25-key-design-decisions) | Do not implement per-kind shapes; all nodes are ellipses |
| CE error → empty-state; no partial render (FR-001) | [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements) | Cytoscape must NOT be initialised if elements is empty due to error; prevents phantom canvas state |
| Semantic zoom thresholds tunable (not hard-coded literals) (FR-005) | [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements) | Threshold values must come from a config object; no magic numbers in component |
| No global keyboard capture for Cmd+K / Cmd+0 (FR-007) | [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements) | Key listener must check `cy.container().contains(document.activeElement)` before firing |
| React SPA, modular; Next.js 15 App Router; TypeScript strict (confirmed stack) | [CLAUDE.md](../../../../../../../CLAUDE.md) | ExplorerCanvas is a Next.js client component (dynamic import with `ssr: false`); Cytoscape runs in browser only |
| Secrets in AWS Secrets Manager only | [CLAUDE.md](../../../../../../../CLAUDE.md) | No API keys or CE connection strings in `.env` or source; fetched via Secrets Manager at runtime |

## Test Requirements

### Unit Tests (minimum 5)

- `should map CE palette kind IDs to Cytoscape node colours and apply grey fallback for unknown kind`
- `should render empty-state component and not initialise Cytoscape when fetchGraph throws CeReadError`
- `should hide node labels when canvas zoom drops below the node-label threshold (config-driven)`
- `should NOT prevent default key event when canvas container does not contain activeElement`
- `should paginate CE-READ-1 SPARQL calls until has_more_pages is false`
- `should render MiniMap component mounted in bottom-right viewport corner`

### Integration Tests (minimum 3)

- `should call CE-READ-1 /api/sparql with Cognito JWT and build correct Cytoscape element set from paginated rows`
- `should show retry button and empty canvas when CE-READ-1 SPARQL returns 503 (stubbed)`
- `should produce zero Cytoscape elements when CE-READ-1 returns rows scoped to tenant-B only (cross-tenant isolation)`

### E2E Tests (minimum 2)

- `should render labelled nodes on the force canvas for an authenticated viewer on first load (Playwright)`
- `should not capture global Cmd+0 key event when a text input outside the canvas has keyboard focus (Playwright)`

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `should call CE-READ-1 /api/sparql with Cognito JWT and build correct Cytoscape element set…` |
| AC-2 | Integration | `should show retry button and empty canvas when CE-READ-1 SPARQL returns 503` |
| AC-3 | Unit | `should map CE palette kind IDs to Cytoscape node colours and apply grey fallback for unknown kind` |
| AC-4 | E2E | `should render labelled nodes on the force canvas for an authenticated viewer…` (zoom interaction included) |
| AC-5 | Unit | `should render MiniMap component mounted in bottom-right viewport corner` |
| AC-6 | Unit | `should hide node labels when canvas zoom drops below the node-label threshold` |
| AC-7 | Unit | `should NOT prevent default key event when canvas container does not contain activeElement` |
| AC-7 | E2E | `should not capture global Cmd+0 key event when a text input outside the canvas has focus` |
| AC-8 | Integration | `should call CE-READ-1 /api/sparql with Cognito JWT…` (perf AC validated by OQ-01 harness) |
| AC-9 | Integration | `should produce zero Cytoscape elements when CE-READ-1 returns rows scoped to tenant-B only` |

## Dependencies

- **blocked_by:** [TASK-001 (AC-8 performance AC gated on SPIKE sign-off)]
- **unlocks:** [TASK-003, TASK-004, TASK-005]
- **External:** "CE-READ-1 stub available for integration tests (fixture JSON conforming to CE-READ-1
  contract shapes)"

## Cost Estimate

- **Complexity:** L (new frontend module, Cytoscape integration, pagination, semantic zoom, key
  bindings, mini-map)
- **Estimated tokens:** ~12k input, ~8k output
- **Estimated cost:** ~$1.20 (claude-fable-5 at time of writing)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (CE-READ-1 shapes documented)
- [ ] Diagram references included — Pending: tech-spec not yet written; known blocker (Architect
  creates tech-spec before implementation starts)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] JSDoc / docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-001

## Implementation Hints

- Use `next/dynamic` with `ssr: false` for the ExplorerCanvas component — Cytoscape.js accesses
  `window` and will throw during Next.js SSR.
- The fcose layout params (node repulsion, gravity, ideal edge length, etc.) are pinned in
  `prototype-findings.md` — copy them verbatim; do not tune during implementation.
- Throttle the mini-map viewport update to one call per `requestAnimationFrame` (≤ 16 ms) using
  a simple `requestAnimationFrame`-based throttle, not `lodash.throttle` — Cytoscape's `viewport`
  event fires on every frame during pan/zoom and will saturate the call stack otherwise.
- For cross-tenant isolation: the Next.js API proxy route at `/api/proxy/sparql` must forward the
  `Authorization: Bearer {jwt}` header verbatim and must NOT add a `graph=` parameter override;
  CE-READ-1 enforces named-graph scoping server-side from the JWT's tenant claim.
- The `performance.memory` API (used in the benchmark harness) is Chrome-only and must NOT be
  called in production application code — keep it in the harness page only.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
