---
type: Task Brief
title: "Task: TASK-005 — Drill-In: Domain Focus, Neighbourhood Expand/Collapse, Impact Traversal"
description: "Right-click domain focus; neighbour expand/collapse with confirm gate; OQ-09-gated
  impact/dependency trace via CE-READ-1 SPARQL property-path SELECT. No hard-coded predicates."
tags: [graph-explorer, 04-arch, task, m1, drill-in, traversal]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-002
milestone: M1
created: 2026-07-01
blocked_by: [TASK-002, TASK-003]
unlocks: []
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

# Task: TASK-005 — Drill-In: Domain Focus, Neighbourhood Expand/Collapse, Impact Traversal

> **OQ-09 gate (E2-S3 / AC-6):** Impact traversal predicates must NOT be hard-coded. The predicate
> closure is confirmed against the shipped BPMO relationship types at CE data-model stage (OQ-09).
> AC-6 and AC-7 are blocked until OQ-09 is resolved and the predicate closure config is available.
> Domain focus (AC-1–AC-2) and neighbour expand/collapse (AC-3–AC-5) have no dependency on OQ-09
> and can be implemented and shipped independently.

## Story

**Epic:** [EPIC-002](../../../graph-explorer.md#epic-002--drill-in--domain-focus--m1)
**Status:** Backlog
**Priority:** Must Have

**As a** viewer or enterprise architect
**I want** to right-click a domain to focus the canvas on its members, expand or collapse any
node's neighbourhood, and trace the full impact or dependency chain from any node
**So that** I can understand how domains interconnect and which upstream or downstream entities are
affected by a change, without needing to read SPARQL or raw IRIs.

Covers: FR-009, FR-033, FR-010 from [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN a viewer right-clicks a domain node and selects "Focus domain", THE SYSTEM SHALL send a CE-READ-1 SPARQL SELECT querying members of that domain and filter the canvas to those member nodes; all other nodes and edges SHALL be de-emphasised to opacity 0.18 (tunable); a CE-READ-1 error or timeout SHALL show an error notice and restore the full graph to full opacity. | `test_domain_focus_filters_to_domain_members`, `test_domain_focus_restores_on_ce_error` |
| AC-2 | WHEN a domain focus query returns zero member rows, THE SYSTEM SHALL display an empty-state message ("This domain has no members") while keeping the rest of the canvas de-emphasised. | `test_domain_focus_empty_state_message` |
| AC-3 | WHEN a viewer requests neighbour expansion on a spotlighted node, THE SYSTEM SHALL call CE-READ-1 `GET /api/ontology/resource/{iri}` for that node's immediate neighbours and attach newly-discovered nodes and edges to the Cytoscape canvas; nodes already present in the canvas SHALL be highlighted, not duplicated. | `test_expand_neighbours_attaches_new_nodes_no_duplicates` |
| AC-4 | WHEN the neighbour expansion would add more than 500 nodes (tunable), THE SYSTEM SHALL display a confirmation dialog ("Load N more nodes — continue?") before issuing the CE-READ-1 fetch; if the viewer cancels, no fetch SHALL occur and the canvas SHALL be unchanged. | `test_expand_large_neighbourhood_requires_confirmation` |
| AC-5 | WHEN a viewer collapses a previously-expanded neighbourhood, THE SYSTEM SHALL remove from the canvas the nodes that were added by that expansion and have no other retained connections; the focus node SHALL remain visible. | `test_collapse_removes_expanded_neighbours_keeps_focus_node` |
| AC-6 | WHEN a viewer requests impact or dependency traversal from a spotlighted node, THE SYSTEM SHALL send a SPARQL property-path SELECT to CE-READ-1 using the predicate closure confirmed at OQ-09 resolution; **no predicate IRI strings SHALL be hard-coded in the implementation** — the predicate path expression SHALL be loaded at runtime from the OQ-09-confirmed config. Traversal depth SHALL default to all reachable nodes, capped at N (default 6, tunable). **This AC is blocked until OQ-09 is resolved by the CE team.** | `test_impact_traversal_loads_predicate_closure_from_config`, `test_impact_traversal_depth_cap_applied` |
| AC-7 | WHEN traversal results arrive, THE SYSTEM SHALL highlight nodes already on the canvas that appear in the traversal chain; nodes not on the canvas SHALL be auto-loaded and added (up to the depth cap); nodes beyond the cap SHALL be badged as "N more in chain" and SHALL NOT be silently truncated. | `test_traversal_highlights_on_canvas_nodes`, `test_traversal_badges_beyond_cap` |
| AC-8 | WHEN the impact overlay is active, THE SYSTEM SHALL preserve the traversal result through pan, zoom, and filter changes; WHEN the source node is removed from the canvas, THE SYSTEM SHALL auto-clear the overlay. | `test_impact_overlay_persists_through_viewport_change`, `test_impact_overlay_clears_on_source_delete` |
| AC-9 | WHEN CE-READ-1 returns an error on any traversal, domain-focus, or expansion fetch, THE SYSTEM SHALL show a dismissable error notice with a retry option; existing canvas elements SHALL remain unchanged. | `test_traversal_ce_error_notice_no_canvas_change` |
| AC-10 | WHEN any drill-in read is issued under a tenant-A JWT, THE SYSTEM SHALL receive zero tenant-B nodes, edges, or traversal hops; CE-READ-1 enforces tenant scoping via named-graph query rewriting from the Cognito JWT. | `test_cross_tenant_drill_in_isolation` |

## Implementation

### Pseudocode

```
# Domain Focus — client-side TypeScript

function onDomainFocusSelect(domainNode: CytoscapeNode, cy: Cytoscape,
                              jwt: string, config: Config):
  domainIri = domainNode.data("node_iri")
  if not jwt: showErrorNotice("Unauthorised"); return

  members = await fetchDomainMembers(jwt, domainIri, config)
  if members.type == "error":
    showErrorNotice(members.message, onRetry=() =>
      onDomainFocusSelect(domainNode, cy, jwt, config))
    cy.elements().style({ opacity: 1.0 })   # restore on error
    return

  cy.elements().style({ opacity: config.spotlight_dim_opacity })  # dim all (default 0.18)
  if members.rows.length == 0:
    showEmptyState("This domain has no members")
    return

  memberIris = new Set(members.rows.map(r => r.entity_iri))
  cy.nodes()
    .filter(n => memberIris.has(n.data("node_iri")))
    .style({ opacity: 1.0 })
  # Edges between visible members also restore (Cytoscape conditional selector)

async function fetchDomainMembers(jwt: string, domainIri: string, config: Config):
  # Parameterised SPARQL SELECT; predicate for domain membership is sourced from
  # config.domain_membership_predicate (set at CE data-model confirmation, not hard-coded here)
  sparqlQuery = buildDomainMemberQuery(domainIri, config.domain_membership_predicate)
  resp = await fetch("/api/proxy/sparql?version=latest",
    { method: "POST", body: sparqlQuery,
      headers: { Authorization: "Bearer " + jwt,
                 "Content-Type": "application/sparql-query" },
      signal: AbortSignal.timeout(config.ce_timeout_ms) })
  if not resp.ok: return { type: "error", message: `CE error ${resp.status}` }
  data = await resp.json()
  return { type: "ok", rows: data.rows }   # [{ entity_iri, entity_label }]


# Neighbour Expand / Collapse — client-side TypeScript

expandedByNode: Map<string, Set<string>> = new Map()  # sourceNodeId → Set<addedNodeId>

async function onExpandNeighbours(node: CytoscapeNode, cy: Cytoscape,
                                   jwt: string, config: Config):
  nodeIri = node.data("node_iri")
  neighbours = await fetchNodeNeighbours(jwt, nodeIri, config)  # CE-READ-1 /api/ontology/resource/{iri}
  if neighbours.type == "error":
    showErrorNotice(neighbours.message)
    return

  newNodes = neighbours.filter(n => cy.getElementById(n.iri).length == 0)

  if newNodes.length > config.expand_confirm_threshold:   # default 500, tunable
    confirmed = await showConfirmDialog(
      `Load ${newNodes.length} more nodes — continue?`
    )
    if not confirmed: return

  addedIds = new Set()
  cy.add(newNodes.map(n => ({ group: "nodes", data: toNodeData(n) })))
  newNodes.forEach(n => addedIds.add(n.iri))
  expandedByNode.set(node.id(), addedIds)
  cy.layout({ name: "fcose", fit: false, ...config.fcose_params }).run()

function onCollapseNeighbours(node: CytoscapeNode, cy: Cytoscape):
  addedIds = expandedByNode.get(node.id()) || new Set()
  toRemove = cy.nodes().filter(n =>
    addedIds.has(n.data("node_iri")) AND
    not hasRetainedConnections(n, node.id(), cy)  # don't remove if connected to other visible nodes
  )
  cy.remove(toRemove)
  expandedByNode.delete(node.id())


# Impact / Dependency Traversal (OQ-09 — no hard-coded predicates)

async function onImpactTraverse(sourceNode: CytoscapeNode, cy: Cytoscape,
                                 jwt: string, config: Config):
  predicateClosure = config.oq09_predicate_closure  # populated at OQ-09 resolution; not a string literal
  if not predicateClosure:
    showErrorNotice(
      "Impact traversal predicates not yet confirmed (OQ-09 pending). " +
      "This feature is unavailable until the CE data-model is finalised."
    )
    return

  sourceIri = sourceNode.data("node_iri")
  depthCap = config.traversal_depth_cap   # default 6, tunable

  # LIMIT = depthCap + 1 so we can detect "beyond cap" without fetching the full graph
  result = await fetchTraversal(jwt, sourceIri, predicateClosure, depthCap + 1, config)
  if result.type == "error":
    showErrorNotice(result.message)
    return   # canvas elements unaffected

  rows = result.rows
  beyondCap = rows.length > depthCap
  rows = rows.slice(0, depthCap)   # truncate to cap

  onCanvasIris = new Set(cy.nodes().map(n => n.data("node_iri")))
  inTraversal = rows.filter(r => onCanvasIris.has(r.entity_iri))
  offCanvas   = rows.filter(r => not onCanvasIris.has(r.entity_iri))

  # Highlight on-canvas traversal members (amber border)
  cy.nodes()
    .filter(n => inTraversal.some(r => r.entity_iri == n.data("node_iri")))
    .style({ "border-width": 3, "border-color": "#F59E0B" })

  # Auto-load off-canvas nodes (up to cap)
  if offCanvas.length > 0:
    cy.add(offCanvas.map(r => ({ group: "nodes", data: toNodeData(r) })))

  # Badge if beyond cap
  if beyondCap:
    showTraversalBadge(sourceNode,
      `${rows.length - inTraversal.length - offCanvas.length} more in chain`)

  # Pin overlay
  impactOverlay = { active: true, sourceIri, rows }
  registerOverlayClearOnSourceDelete(sourceNode, cy)

async function fetchTraversal(jwt: string, sourceIri: string,
                               predicateClosure: string, limit: number,
                               config: Config):
  # predicateClosure is the SPARQL path expression string from OQ-09 config
  # e.g. "(schema:dependsOn|schema:rulesOn)*" — populated by config, not assembled here
  sparqlQuery = buildTraversalQuery(sourceIri, predicateClosure, limit)
  resp = await fetch("/api/proxy/sparql?version=latest",
    { method: "POST", body: sparqlQuery,
      headers: { Authorization: "Bearer " + jwt,
                 "Content-Type": "application/sparql-query" },
      signal: AbortSignal.timeout(config.ce_timeout_ms) })
  if not resp.ok: return { type: "error", message: `CE error ${resp.status}` }
  return { type: "ok", rows: (await resp.json()).rows }

function registerOverlayClearOnSourceDelete(sourceNode: CytoscapeNode, cy: Cytoscape):
  cy.on("remove", "node", (e) => {
    if e.target.data("node_iri") == impactOverlay.sourceIri:
      clearImpactOverlay(cy)
  })
```

### API Contracts

This task calls CE-READ-1 SPARQL SELECT and the single-entity endpoint. It does not define new
Explorer API endpoints in M1.

CE-READ-1 SPARQL consumed by this task (shapes from [contracts.md](../../../../contracts.md)):

**Domain focus query — `POST /api/sparql?version=latest`** body (parameterised SELECT):

The domain-membership predicate is loaded from config at OQ-09 / CE data-model confirmation.
The query pattern is:

```sparql
SELECT ?entity_iri ?entity_label
WHERE {
  ?entity_iri <{domain_membership_predicate}> <{domainIri}> .
  ?entity_iri rdfs:label ?entity_label .
}
```

**Impact traversal query — `POST /api/sparql?version=latest`** body (parameterised property-path
SELECT):

```sparql
SELECT ?entity_iri
WHERE {
  <{sourceIri}> ({predicateClosure})* ?entity_iri .
}
LIMIT {depthCap + 1}
```

`predicateClosure` is the OQ-09-confirmed SPARQL path expression; it is not assembled from string
literals in this codebase.

**`GET /api/ontology/resource/{iri}`** (neighbour expansion, CE-READ-1):

Response `200`:

```json
{
  "iri":       "https://…",
  "neighbours": [
    { "iri": "https://…", "label": "…", "bpmo_kind": "…",
      "edge_predicate": "…", "edge_direction": "outgoing" }
  ]
}
```

Error responses (all CE-READ-1 calls):

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` |
| 404 | IRI not found or belongs to another tenant | `{"error": "not_found"}` |
| 503 | CE store unavailable | `{"error": "store_unavailable"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|------------------|---------|
| Sequence | `../tech-spec/business-process.md` | `#drill-in-flow` | Pending — to be added to tech-spec before implementation starts |
| State | `../tech-spec/business-process.md` | `#traversal-overlay-state` | Pending — to be added to tech-spec before implementation starts |
| Data Model | `../tech-spec/data-model.md` | `#bpmo-relationship-types` | Pending — OQ-09 resolution required before this diagram can be written; flagged as blocker for AC-6 |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|---------------------|
| Impact traversal predicates NOT hard-coded — confirmed at CE data-model via OQ-09 (SS-GE-4) | [graph-explorer.md §2.5](../../../graph-explorer.md#25-key-design-decisions) | AC-6 and AC-7 are blocked until OQ-09 is resolved; predicate path must be loaded from `config.oq09_predicate_closure`, never from string literals in this codebase |
| Traversal depth cap N (default 6, tunable); LIMIT = cap + 1 to detect beyond-cap; never silently truncate (FR-010) | [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements) | The SPARQL LIMIT must be cap + 1; beyond-cap badge is mandatory, not optional |
| Expand confirmation required when > 500 nodes (tunable) (FR-033) | [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements) | The confirm dialog must block the CE fetch call, not just warn after loading; confirmation is synchronous (await modal result) |
| CE-READ-1 SELECT-only; `SERVICE` keyword blocked (SSRF); paginated (contract constraint) | [contracts.md §CE-READ-1](../../../../contracts.md#ce-read-1--versioned-read-interface) | SPARQL traversal must use property-path SELECT syntax only; no CONSTRUCT or SERVICE |
| CE error on drill-in → error notice + retry; existing canvas elements unaffected (FR-010 failure mode) | [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements) | Error handling must not mutate cy.elements() on failure; restore opacity before showing notice |
| No predicates hard-coded in this codebase (SS-GE-4) — also applies to domain-membership predicate | [graph-explorer.md §2.4 OQ-09](../../../graph-explorer.md#24-open-questions) | `config.domain_membership_predicate` and `config.oq09_predicate_closure` are both set externally; any literal predicate string in this codebase is a defect |

## Test Requirements

### Unit Tests (minimum 5)

- `should de-emphasise all non-member nodes to opacity 0.18 when domain focus returns member list`
- `should show "This domain has no members" empty-state when domain focus returns zero rows`
- `should show confirmation dialog and NOT call CE-READ-1 when expansion would add >500 nodes and
  viewer cancels`
- `should NOT contain any hard-coded predicate IRI string literal in traversal query builder
  function`
- `should badge "N more in chain" when traversal result count exceeds the depth cap`

### Integration Tests (minimum 3)

- `should call CE-READ-1 SPARQL SELECT with domain IRI and return member list (CE-READ-1 stub)`
- `should call CE-READ-1 property-path SELECT with OQ-09 predicate closure from config and return
  traversal rows (CE-READ-1 stub)`
- `should return zero traversal hops under tenant-A JWT when source node IRI belongs to tenant-B
  (cross-tenant isolation, CE-READ-1 stub)`

### E2E Tests (minimum 2)

- `should right-click a domain, select "Focus domain", and see only that domain's nodes at full
  opacity (Playwright)`
- `should click "Trace impact" on a node and see the traversal chain highlighted and a "N more in
  chain" badge for results beyond the depth cap (Playwright)`

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `should call CE-READ-1 SPARQL SELECT with domain IRI and return member list` |
| AC-1 (error) | Unit | `should show error notice and restore canvas opacity on CE-READ-1 failure` |
| AC-2 | Unit | `should show "This domain has no members" empty-state when domain focus returns zero rows` |
| AC-3 | Integration | `should call CE-READ-1 /api/ontology/resource/{iri} and attach new nodes without duplicates` |
| AC-4 | Unit | `should show confirmation dialog and NOT call CE-READ-1 when expansion would add >500 nodes and viewer cancels` |
| AC-5 | Unit | `should remove expanded neighbour nodes on collapse while keeping the focus node` |
| AC-6 | Integration | `should call CE-READ-1 property-path SELECT with OQ-09 predicate closure from config…` |
| AC-6 (no hardcode) | Unit | `should NOT contain any hard-coded predicate IRI string literal in traversal query builder` |
| AC-7 (badge) | Unit | `should badge "N more in chain" when traversal result count exceeds the depth cap` |
| AC-7 (E2E) | E2E | `should click "Trace impact" on a node and see the traversal chain highlighted…` |
| AC-8 | E2E | `should click "Trace impact" on a node and see the traversal chain highlighted…` (overlay persists through pan/zoom) |
| AC-9 | Unit | `should show error notice and restore canvas opacity on CE-READ-1 failure` |
| AC-10 | Integration | `should return zero traversal hops under tenant-A JWT when source node IRI belongs to tenant-B` |

## Dependencies

- **blocked_by:** [TASK-002 (Cytoscape canvas must be initialised), TASK-003 (spotlight is the
  entry point for traversal UI)]
- **unlocks:** []
- **External:** "OQ-09 resolved: predicate closure confirmed by CE team and provided as
  `config.oq09_predicate_closure` before AC-6 implementation can start"

## Cost Estimate

- **Complexity:** L (3 interaction modes; SPARQL parameterisation; depth-cap logic; expand
  confirmation gate; overlay state; cross-tenant isolation)
- **Estimated tokens:** ~14k input, ~9k output
- **Estimated cost:** ~$1.50 (claude-opus-4-8 at time of writing)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (CE-READ-1 SPARQL shapes and single-entity endpoint documented)
- [ ] Diagram references included — Pending: tech-spec not yet written; OQ-09 resolution required
  for data-model diagram (flagged as blocker for AC-6)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (OQ-09 external dependency explicitly named)
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
- [ ] PR references this task and EPIC-002

## Implementation Hints

- Do not assemble the traversal SPARQL path expression by concatenating predicate name strings in
  code. `config.oq09_predicate_closure` is a pre-built SPARQL path string (e.g.
  `"(ex:dependsOn|ex:rulesOn)*"`) populated at OQ-09 resolution — write `buildTraversalQuery`
  to accept this string as a parameter, not to construct it from parts.
- The SPARQL LIMIT trick (`depthCap + 1`) means you can detect "beyond cap" from the row count
  without fetching the entire reachable subgraph; this avoids a separate COUNT query and keeps
  CE load bounded.
- Track expanded-neighbour IDs on the source Cytoscape node's data
  (`node.data("expanded_neighbours", addedIds)`) rather than in React state — this survives React
  re-renders and keeps the expand/collapse logic co-located with the graph element.
- The domain-focus opacity restoration on error must happen unconditionally (not inside the
  `members.rows.length > 0` branch); if CE returns an error after the canvas has already been
  dimmed, the dim must be reversed before showing the error notice.
- For cross-tenant isolation in integration tests: use a CE-READ-1 stub that enforces named-graph
  scoping from the JWT tenant claim; assert that a traversal query issued with a tenant-A JWT and
  a tenant-B source IRI returns `rows: []` from the stub.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
