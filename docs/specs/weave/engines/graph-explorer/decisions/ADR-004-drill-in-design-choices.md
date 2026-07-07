---
type: Decision
title: "ADR-004: Drill-in design choices — neighbour reuse, expanded-state tracking, config-literal defaults"
description: "Engine-local decisions made while implementing TASK-005 (domain focus, neighbour
  expand/collapse) that the task brief's AC/pseudocode left open: reusing the side panel's
  already-fetched neighbours instead of a second CE-READ-1 call, tracking expanded-neighbour ids on
  cytoscape node data instead of React state, the domainKind/domainMembershipPredicate config-literal
  defaults pending CE ontology confirmation, and scoping the right-click context menu to the
  currently-spotlighted node."
tags: [decision, adr, graph-explorer, drill-in, task-005, m1]
status: Accepted
timestamp: 2026-07-05T00:00:00Z
resource: docs/specs/weave/engines/graph-explorer/decisions/ADR-004-drill-in-design-choices.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: graph-explorer
---

# ADR-004: Drill-in design choices (TASK-005)

**Scope:** [Graph Explorer](../../graph-explorer.md) M1, TASK-005 (domain focus, neighbour
expand/collapse; impact traversal is OQ-09-gated and out of scope for this ADR).

## Status

**Accepted** — implemented across the `feature/GE-EPIC-002` commits for TASK-005.

## Decisions

### 1. Neighbour expansion reuses the side panel's already-fetched neighbours

AC-3 requires calling `GET /api/ontology/resource/{iri}` for a node's immediate neighbours; AC-4
requires a confirm gate "before issuing the CE-READ-1 fetch". Read literally, these two ACs
conflict if expand always issues its own fresh fetch, because the confirm gate needs the neighbour
count *before* fetching — but the count only exists *after* fetching.

**Resolution:** `use-node-spotlight.ts`'s `fetchNodeProps` call (already made when a node is
spotlighted, to populate the side panel) already returns the node's `neighbours`. Neighbour
expansion never issues a second CE-READ-1 call — `useNeighbourExpansion.requestExpand` is handed
the panel's already-fetched neighbour list directly. AC-4's "confirm before fetch" becomes
trivially true: there is no fetch at expand-time, only a canvas-mutation gate
(`config.expandConfirmThreshold`).

**Consequence:** the right-click context menu's "Expand neighbours" / "Collapse neighbours" items
are only offered for the *currently spotlighted* node (`use-node-context-menu.ts`). A right-click on
a node that hasn't been tapped first has no neighbour data available and shows no menu at all (see
decision 4). This is a scope-narrowing simplification, not a bug: the UX flow is tap-to-spotlight,
then right-click the same node.

### 2. Expanded-neighbour ids tracked on cytoscape node data, not React state

`hasExpandedNeighbours(nodeId)` reads the same `expandedNeighbourIds` cytoscape node-data key that
`expandNode`/`collapseNode` write/clear (`lib/explorer/renderer-adapter.ts`), rather than a
`Set<nodeId>` inside `useNeighbourExpansion`'s own React state. A cytoscape-node-data source of
truth survives remounts of any consuming hook/component; a parallel React `Set` would desync the
first time a component holding it remounts while the canvas doesn't.

### 3. `domainKind` and `domainMembershipPredicate` are config-literal defaults, not ontology lookups

Per [ontology-standards.md](../../../../../.claude/rules/ontology-standards.md), the canonical
kind/relationship set is served by `GET /api/ontology/types` (`CE-READ-1`), not hard-coded. TASK-005
needs to know (a) which SPARQL predicate expresses domain membership
(`config.domainMembershipPredicate`) and (b) which `bpmoKind` value marks a node as a domain
(`config.domainKind`, added this task) to decide whether "Focus domain" appears on the context menu.

Neither value is available from any existing config/ontology-types source consumed by this
codebase at TASK-005 time, and the task brief's own pseudocode already established the
`config.domain_membership_predicate` precedent (never a literal in the query-builder). This ADR
extends the same precedent to `domainKind`: both are `ExplorerConfig` fields with a literal default
(`"https://weave.example/ontology/bpmo#memberOfDomain"`, `"Domain"`), living in
`lib/explorer/config.ts` only, never in a component or query builder. **These defaults are
placeholders pending confirmation against the CE team's shipped BPMO kind/predicate names** — the
same open item already flagged for `domainMembershipPredicate` in TASK-005's design-decisions table
now also covers `domainKind`.

### 4. Right-click menu surface: `getNodeData` for domain-kind, panel state for expand/collapse

`useNodeContextMenu` derives `canFocusDomain` from `adapter.getNodeData(nodeId)?.bpmoKind` (the
cytoscape-loaded kind from the original graph SPARQL page), not from the CE-READ-1 resource-fetch
response — the two are logically the same value but the former is always available synchronously
with no fetch, which is what a right-click handler needs. The menu opens (any items) only when the
right-clicked node is the currently-spotlighted one (`panel.status === "loaded" && panel.nodeId ===
nodeId`); this deliberately also gates "Focus domain" behind the node being spotlighted first, even
though domain-focus itself has no data dependency on the panel. Keeping one right-click semantics
(instead of two: "domain nodes react to right-click unconditionally, other nodes only when
spotlighted") was judged simpler and adequate for M1 — revisit if user testing shows viewers expect
to right-click a domain node without tapping it first.

## Consequences

- No second CE-READ-1 call is ever made for neighbour expansion — network cost stays bounded to the
  spotlight fetch already paid for AC-1/AC-2 (TASK-003).
- `domainKind`/`domainMembershipPredicate` are a single source of truth in `ExplorerConfig`; a CE
  ontology rename only requires editing `DEFAULT_EXPLORER_CONFIG`, never a component or query
  builder.
- Right-clicking a non-spotlighted node currently does nothing (no menu, no error) — an accepted
  M1 UX gap, not a defect, given decision 4 above.
