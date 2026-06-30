---
type: Task Brief
title: "Task: TASK-003 — Node Spotlight + Search Overlay"
description: "Node click → spotlight neighbourhood + side panel (no raw IRI for business users);
  Cmd+K search overlay highlighting matching nodes and centring on result click."
tags: [graph-explorer, 04-arch, task, m1]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-001
milestone: M1
created: 2026-07-01
blocked_by: [TASK-002]
unlocks: [TASK-005]
adr_refs: []
timestamp: 2026-07-01T00:00:00Z
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: e6499f88873d7157bed76c3632ce25e2f5fb6d4b
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
---

# Task: TASK-003 — Node Spotlight + Search Overlay

## Story

**Epic:** [EPIC-001](../../../graph-explorer.md#epic-001--whole-company-canvas-force-mode--m1)
**Status:** Backlog
**Priority:** Must Have

**As a** viewer (operations staff, leadership, compliance, or enterprise architect)
**I want** to click any node to spotlight it with a properties side panel, and to search for nodes
by name or type using Cmd+K
**So that** I can locate and understand specific entities without seeing raw IRIs or writing SPARQL.

Covers: FR-006, FR-007 from [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN a viewer clicks a node, THE SYSTEM SHALL dim all canvas elements outside the clicked node's `closedNeighborhood` to opacity 0.18 (tunable); the clicked node and its immediate neighbours SHALL remain at full opacity 1.0. | `test_spotlight_dims_non_neighbourhood_to_018` |
| AC-2 | WHEN spotlight is active, THE SYSTEM SHALL fetch the node's properties via CE-READ-1 `GET /api/ontology/resource/{iri}` and open a side panel displaying: human-readable label, entity-type name, and key property values. The raw IRI SHALL NOT appear in the default panel view for any role; it SHALL be revealed only under an "Advanced / technical details" disclosure element visible exclusively to users whose Cognito JWT carries the `ontologist` role claim. | `test_side_panel_no_raw_iri_for_viewer`, `test_side_panel_shows_iri_for_ontologist` |
| AC-3 | WHEN the side panel property fetch fails (CE-READ-1 error or timeout, default 10 s, tunable), THE SYSTEM SHALL display the node label and entity-type name already loaded from the Cytoscape element data, alongside a "Details unavailable — retry" notice; the side panel SHALL NOT remain blank or throw a runtime error. | `test_side_panel_graceful_fallback_on_ce_error` |
| AC-4 | WHEN a viewer clicks the canvas background or presses Escape, THE SYSTEM SHALL restore all canvas elements to full opacity 1.0 and close the side panel. | `test_spotlight_clears_on_background_click`, `test_spotlight_clears_on_escape` |
| AC-5 | WHEN a viewer presses Cmd/Ctrl+K (canvas or page in focus) or clicks the sidebar search icon, THE SYSTEM SHALL open a search overlay; as the viewer types, nodes matching the query on `rdfs:label`, `skos:prefLabel`, or entity-type label (case-insensitive substring) SHALL highlight at full opacity; non-matching nodes SHALL dim to 0.18. | `test_search_overlay_opens_on_cmd_k`, `test_search_highlights_matching_nodes` |
| AC-6 | WHEN a viewer clicks a search result, THE SYSTEM SHALL close the search overlay, animate the canvas to centre on that node (300 ms, tunable), and apply the spotlight effect (AC-1 and AC-2). | `test_search_result_click_centres_and_spotlights` |
| AC-7 | WHEN the search query matches zero nodes, THE SYSTEM SHALL display a "No results found" message in the search overlay and leave all canvas elements at their current opacity. | `test_search_no_results_message` |
| AC-8 | WHEN any side panel property fetch is issued under a tenant-A JWT with a node IRI that belongs to tenant-B, THE SYSTEM SHALL receive HTTP 404 from CE-READ-1 and display a "Not found" message in the side panel without leaking any tenant-B label, type, or property data. | `test_cross_tenant_spotlight_isolation` |

## Implementation

### Pseudocode

```
# Node Spotlight — Cytoscape event handler (client-side TypeScript)

function onNodeClick(event: CytoscapeEvent, cy: Cytoscape, jwt: string, config: Config):
  clicked = event.target
  if clicked === cy: return  # background click → handled by onBackgroundClick

  # Optimistic spotlight (immediate, no wait for CE)
  neighbourhood = clicked.closedNeighborhood()
  cy.elements().not(neighbourhood).style({ opacity: config.spotlight_dim_opacity })  # default 0.18
  neighbourhood.style({ opacity: 1.0 })

  # Open side panel with data already in Cytoscape element (no CE call yet)
  openSidePanel({
    state: "loading",
    label:     clicked.data("label"),
    typeLabel: clicked.data("type_label") || clicked.data("bpmo_kind"),
  })

  # Async CE-READ-1 fetch for full properties
  nodeIri = clicked.data("node_iri")
  result = await fetchNodeProps(jwt, nodeIri, config)

  if result.type == "error":
    updateSidePanel({ state: "error" })  # label/type already shown; "Details unavailable" appended
    return

  userRole = getCognitoRoleClaim(jwt)  # "ontologist" | "BA" | "viewer"
  updateSidePanel({
    state:      "loaded",
    label:      result.label,
    typeLabel:  result.type_label,
    properties: result.key_properties,
    rawIri:     userRole == "ontologist" ? result.iri : null,  # null hides disclosure section
  })


function fetchNodeProps(
    jwt: string, iri: string, config: Config
): NodeProps | { type: "error"; status: number }:
  # Input gates
  if not jwt:                return { type: "error", status: 401 }
  if not isAbsoluteIRI(iri): return { type: "error", status: 422 }

  resp = await fetch(
    `/api/proxy/ontology/resource/${encodeURIComponent(iri)}`,
    {
      headers: { Authorization: "Bearer " + jwt },
      signal:  AbortSignal.timeout(config.ce_timeout_ms),  # default 10_000
    }
  )
  if resp.status == 401: return { type: "error", status: 401 }
  if resp.status == 404: return { type: "error", status: 404 }  # tenant-B or not found
  if not resp.ok:        return { type: "error", status: resp.status }
  return await resp.json()  # { iri, label, type_label, bpmo_kind, key_properties: [...] }


function onBackgroundClick(event: CytoscapeEvent, cy: Cytoscape):
  if event.target !== cy: return  # not a true background click
  cy.elements().style({ opacity: 1.0 })
  closeSidePanel()


function onEscapeKey(cy: Cytoscape):
  cy.elements().style({ opacity: 1.0 })
  closeSidePanel()
  closeSearchOverlay()


# Search Overlay — client-side only (no CE call)

function onSearchQueryChange(query: string, cy: Cytoscape, config: Config):
  if query.trim().length == 0:
    cy.elements().style({ opacity: 1.0 })
    clearResultsList()
    return

  normalised = query.toLowerCase()
  matched = cy.nodes().filter(node =>
    node.data("label")?.toLowerCase().includes(normalised)
    OR node.data("skos_pref_label")?.toLowerCase().includes(normalised)
    OR node.data("type_label")?.toLowerCase().includes(normalised)
  )

  if matched.length == 0:
    showNoResultsMessage()
    return

  cy.elements().style({ opacity: config.spotlight_dim_opacity })  # dim all
  matched.style({ opacity: 1.0 })                                 # highlight matches
  renderResultsList(matched)


function onSearchResultClick(
    nodeId: string, cy: Cytoscape, jwt: string, config: Config
):
  closeSearchOverlay()
  cy.elements().style({ opacity: 1.0 })  # restore before centring

  targetNode = cy.getElementById(nodeId)
  if not targetNode.length: return        # node not in graph (stale search result)

  cy.animate(
    { center: { eles: targetNode } },
    { duration: config.centre_animation_ms }  # default 300
  )
  onNodeClick({ target: targetNode }, cy, jwt, config)  # apply spotlight + side panel
```

### API Contracts

This task calls CE-READ-1 for single-entity property fetch. It does not define new Explorer API
endpoints. Search is entirely client-side over the loaded Cytoscape element set.

**`GET /api/ontology/resource/{iri}`** (CE-READ-1, via Next.js proxy route)

Response `200`:

```json
{
  "iri":            "https://example.org/entity/cust-onboarding",
  "label":          "Customer Onboarding",
  "type_label":     "Process",
  "bpmo_kind":      "Process",
  "key_properties": [
    { "path": "rdfs:label",    "label": "Name",     "value": "Customer Onboarding" },
    { "path": "rdfs:comment",  "label": "Description", "value": "…"                }
  ]
}
```

Error responses:

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` |
| 404 | IRI not found or belongs to another tenant | `{"error": "not_found"}` |
| 503 | CE store unavailable | `{"error": "store_unavailable"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|------------------|---------|
| Sequence | `../tech-spec/business-process.md` | `#spotlight-flow` | Pending — to be added to tech-spec before implementation starts |
| State | `../tech-spec/business-process.md` | `#side-panel-states` | Pending — to be added to tech-spec before implementation starts |
| Data Model | `../tech-spec/data-model.md` | `#node-properties` | Pending — to be added to tech-spec before implementation starts |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|---------------------|
| Raw IRI hidden from business-user side panel; exposed only under "Advanced" disclosure for `ontologist` role | [graph-explorer.md §2.5](../../../graph-explorer.md#25-key-design-decisions) | Role check must use the Cognito JWT claim (`getCognitoRoleClaim`), not a client-side flag; the IRI must simply not be passed to the side-panel component for non-ontologist roles |
| Side-panel failure → label + type already loaded + "Details unavailable" notice; never blank or crash (FR-006) | [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements) | Label and type must be read from the Cytoscape element data (already in memory from graph load) before the CE fetch; the side panel opens in "loading" state immediately |
| Search is client-side over loaded nodes only — not a CE query (property filter builder rule applied here too) | [graph-explorer.md §2.5](../../../graph-explorer.md#25-key-design-decisions) | The search overlay must NOT call CE-READ-1; it filters the Cytoscape node set already in memory |
| No global keyboard capture for Cmd+K / Cmd+0 (FR-007) | [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements) | The Cmd+K listener must check focus; it must not call `e.preventDefault()` when a text input has focus |
| CE-READ-1 `GET /api/ontology/resource/{iri}` returns 404 for cross-tenant IRIs | [contracts.md §CE-READ-1](../../../../contracts.md#ce-read-1--versioned-read-interface) | The side panel must handle 404 as "Not found" — never attempt to display partial data from a 404 response |

## Test Requirements

### Unit Tests (minimum 5)

- `should dim all non-neighbourhood elements to opacity 0.18 when a node is clicked`
- `should NOT include raw IRI in side panel props passed to component when JWT role is "viewer"`
- `should include raw IRI in side panel props passed to component when JWT role is "ontologist"`
- `should display label and type with "Details unavailable" notice when fetchNodeProps returns error`
- `should highlight nodes matching rdfs:label substring (case-insensitive) and dim non-matching`

### Integration Tests (minimum 3)

- `should call CE-READ-1 /api/ontology/resource/{iri} with Cognito JWT and return label, type,
  key_properties`
- `should return 404 response and display "Not found" in side panel when IRI belongs to a different
  tenant (cross-tenant isolation stub)`
- `should display "No results found" message when search query matches no loaded nodes`

### E2E Tests (minimum 2)

- `should open side panel with label and entity type (no raw IRI visible) when viewer clicks a
  node (Playwright)`
- `should open search overlay on Cmd+K, highlight matching nodes, and spotlight the clicked result
  (Playwright)`

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Unit | `should dim all non-neighbourhood elements to opacity 0.18 when a node is clicked` |
| AC-2 (no IRI) | Unit | `should NOT include raw IRI in side panel props when JWT role is "viewer"` |
| AC-2 (IRI for ontologist) | Unit | `should include raw IRI in side panel props when JWT role is "ontologist"` |
| AC-2 (E2E) | E2E | `should open side panel with label and entity type (no raw IRI visible)…` |
| AC-3 | Unit | `should display label and type with "Details unavailable" notice when fetchNodeProps returns error` |
| AC-4 | E2E | `should open side panel…` (background click and Escape both tested) |
| AC-5 | Unit | `should highlight nodes matching rdfs:label substring…` |
| AC-5 | E2E | `should open search overlay on Cmd+K, highlight matching nodes…` |
| AC-6 | E2E | `should open search overlay on Cmd+K, highlight matching nodes, and spotlight the clicked result` |
| AC-7 | Integration | `should display "No results found" message when search query matches no loaded nodes` |
| AC-8 | Integration | `should return 404 response and display "Not found" in side panel when IRI belongs to a different tenant` |

## Dependencies

- **blocked_by:** [TASK-002 (Cytoscape canvas must be initialised; element data must be loaded)]
- **unlocks:** [TASK-005 (spotlight pre-condition for traversal UI interaction)]
- **External:** "CE-READ-1 stub returning `/api/ontology/resource/{iri}` fixture JSON for
  integration tests; Cognito test JWT with `ontologist` and `viewer` role claims"

## Cost Estimate

- **Complexity:** M (2 interaction modes: spotlight + search; side panel state machine; role-based
  IRI disclosure; error fallback)
- **Estimated tokens:** ~10k input, ~6k output
- **Estimated cost:** ~$0.90 (claude-opus-4-8 at time of writing)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (CE-READ-1 single-entity shape documented)
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

- The spotlight opacity (0.18) and CE timeout (10 s) must be read from a `config` object, not
  hard-coded as literals — both are described as tunable in the PRD (FR-006).
- The IRI visibility check must use the Cognito role claim from the server-side JWT (extracted in
  the Next.js API proxy route), not a client-side flag that could be spoofed. Pass only the
  fields appropriate for the role in the JSON response; the side panel component receives `rawIri`
  as `null` for non-ontologist roles.
- Use `AbortSignal.timeout(config.ce_timeout_ms)` for the CE fetch (available in Node 18+ and
  modern browsers) rather than a manual `setTimeout` + `AbortController` to avoid a race where
  the abort fires after the response is partially read.
- For cross-tenant isolation: CE-READ-1 returns `404` (not `403`) when the IRI belongs to a
  different tenant; the side panel must handle 404 as "Not found" and must never log or surface
  any data from the response body of a 404.
- `rdfs:label` values may carry `@lang` tags in the underlying RDF; confirm with the CE team that
  the `/api/ontology/resource/{iri}` proxy strips language tags before returning strings, and
  write a unit test asserting that a `"label"@en` value arrives as `"label"` in the side panel.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
