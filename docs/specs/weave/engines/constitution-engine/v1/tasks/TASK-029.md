---
type: Task Brief
title: "Task: TASK-029 — GE-CANVAS-1 Packaging + Contract Conformance Suite"
description: "Package the force canvas as the GraphCanvas workspace export per the ge-canvas-1.md
  pin; implement all nine behavioural rules and the named conformance suite whose report is the
  Build M2 unblock evidence."
tags: [graph-explorer, arch, task, v1]
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-021
milestone: v1
created: 2026-07-08
blocked_by: [TASK-023]
unlocks: [TASK-030]
adr_refs: [ADR-014-render-engine, ADR-019-edit-attribution-principal-iri]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-029 — GE-CANVAS-1 Packaging + Conformance Suite

## Story

**Epic:** [EPIC-021](../../../constitution-engine.md#epic-021--embeddable-canvas-component-ge-canvas-1--force-mode-m2-c4-mode-post-v1)
**Status:** Backlog · **Priority:** Must Have (Build M2 release gate)

**As the** Build Engine (consumer)
**I want** the force canvas as an embeddable component with the exact pinned prop surface and
verified behavioural semantics
**So that** Build M2 can mount project-scoped graph slices and write architecture edits back
without depending on Explorer internals.

Covers: FR-034 / E9-S1. **The pin is normative:**
[ge-canvas-1.md](../../tech-spec/ge-canvas-1.md) — prop types, the nine behavioural rules,
and the conformance test names are all defined there and LOCKED (contract-amendment process
for any change). This brief adds implementation guidance only; on any discrepancy,
ge-canvas-1.md wins.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN the Explorer package builds, THE SYSTEM SHALL export `GraphCanvas` (props exactly `GraphCanvasProps` from ge-canvas-1.md) from the package public API; no other Explorer internal SHALL be importable by Build (enforced via package `exports` field). | `test_package_exports_graphcanvas_only` |
| AC-2 | Behavioural rules 1–9 of ge-canvas-1.md SHALL each pass their named conformance test (`should render project slice when mounted with filterByIri`, `should show empty state when filterByIri matches nothing`, `should throw unsupported-mode error when mode is c4`, `should force readonly when version is pinned`, `should write back through CE-WRITE-1 when edited`, `should return zero tenant-B entities under tenant-A JWT`, `should persist embedded layout under source graph id`, `should render boundary edges as stub markers without pulling in out-of-slice nodes`, `should disable all edit affordances when readonly is true`). | the nine named tests |
| AC-3 | WHEN the conformance suite runs in CI, THE SYSTEM SHALL emit a machine-readable conformance report (JSON: rule → test → pass/fail) as a build artefact — the M2 exit-gate evidence for the Build-M2 unblock HITL row. | `test_conformance_report_artifact_shape` |
| AC-4 | WHEN `GraphCanvas` mounts inside a host route (not the Explorer shell), THE SYSTEM SHALL function without Explorer chrome: it SHALL carry its own empty/error/loading states and require only the host app's auth context (JWT provisioning is the host's). | `test_mounts_standalone_without_explorer_shell` |
| AC-5 | WHERE `readonly: false` and mode/version permit editing, edits SHALL flow through the TASK-023 Edit Controller + write proxy unchanged (ADR-019 attribution included) — the component SHALL NOT own a second write path. | `test_embedded_edit_reuses_write_proxy_single_path` |
| AC-6 | WHEN `source` scopes the layout, drag persistence SHALL target `graph_id = source` through the M1 layout endpoints — no Build-local layout store, per ge-canvas-1.md rule 7. | rule-7 named test |

## Implementation

### Pseudocode

```
# Package boundary (AC-1)
package.json exports: { ".": "./src/public-api.ts" }
public-api.ts: export { GraphCanvas, type GraphCanvasProps }   # nothing else

# Component (rules 1-9 — ge-canvas-1.md is normative; sketch only)
function GraphCanvas({ source, filterByIri, mode, readonly, version }):
  if mode != "force": throw UnsupportedModeError(mode)          # rule 3, at mount
  effectiveReadonly = readonly OR version != undefined          # rule 4
  ctx = { canvasMode: version ? {kind:"version", version} : {kind:"draft"},
          graphId: source, readonly: effectiveReadonly }
  elements = useGraphLoad({ version, filterByIri })             # M1 loader + scope filter
  if elements.empty and filterByIri: return <EmptyState/>       # rule 2
  positions = useLayout(graphId = source)                       # rule 7 — M1 endpoints
  return <CanvasCore adapter elements positions
            editController={effectiveReadonly ? null : sharedEditController}/>  # rule 5

# Scope query (rules 1 + 8): filterByIri → CE-READ-1 SELECT restricted to the slice reachable
# from filterByIri via the closure predicates (TASK-028 config) at depth cap — the "project
# slice" definition; empty result is a valid state, never an error.

# Conformance report (AC-3)
after suite: write conformance-report.json
  [{ rule: 1..9, test: "<name>", status: "pass"|"fail" }] + { generated_at, package_version }
```

### API Contracts

Consumes only existing surfaces: CE-READ-1 via read proxy (scoped load), TASK-023 write proxy
(rule 5), M1 layout endpoints with `graph_id = source` (rule 7). Zero new endpoints. Prop
surface: normative in ge-canvas-1.md — reproduced nowhere else (single source).

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Component context | `../../tech-spec/ge-canvas-1.md` | Mermaid diagram | Build mount → GraphCanvas → proxies/layout paths |
| Component delta | `../../tech-spec/m2-delta-explorer.md` | §6 | GraphCanvas export reuse edges (EditController, read proxy) |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| Pin is LOCKED; changes are contract amendments via coordinator | ge-canvas-1.md stability rule | Implementation discrepancies resolve TOWARD the pin; if the pin is wrong, stop and escalate — do not ship a divergent surface |
| `source` = CE graph id AND layout scope | ge-canvas-1.md prop docs | Rule-7 test enforces; flagged for Build-side reconcile (spec-review note) — if Build's intent differs, amendment lands before this task builds |
| One write path (TASK-023 controller) | ADR-019; invariants-explorer.md | AC-5's "single call-site" grep stays true with the embedded case |
| Project slice semantics are contract-PINNED (contracts.md §GE-CANVAS-1): hop-depth slice; in-slice edges normal; boundary edges = stub markers on the in-slice node, out-of-slice node NOT pulled in; deterministic for fixed input+config | contracts.md §GE-CANVAS-1; ge-canvas-1.md rule 8 | Traversal uses TASK-028 closure + depth-cap config (deterministic by construction) — no bespoke "slice" predicate set; rule-8 test asserts stub markers |

## Test Requirements

### Unit (minimum 3)

- `should throw descriptive unsupported-mode error for mode c4 at mount`
- `should compute effectiveReadonly true when version set regardless of readonly prop`
- `should expose only GraphCanvas via package exports (import-surface test)`

### Conformance suite (exactly the 9 named tests — Playwright + CE/Platform stubs, Law F)

As listed in AC-2; suite tagged `ge-canvas-1-conformance`; emits the JSON report (AC-3).

### Integration (minimum 2)

- `should mount standalone in a bare host route with its own loading/empty/error states`
- `should route embedded edit through the shared write proxy with principal_iri actor`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Unit | import-surface test |
| AC-2 | Conformance | 9 named tests |
| AC-3 | CI check | report-shape test |
| AC-4 | Integration | standalone-mount test |
| AC-5 | Integration | shared-write-path test |
| AC-6 | Conformance | rule-7 test |

## Dependencies

- **blocked_by:** [TASK-023 (Edit Controller + write proxy — rule 5)]
- **unlocks:** TASK-030; **Build M2 decomposition** (external — the release gate this task exists for)
- **External:** TASK-028 closure config for the slice query (soft — a slice via direct
  `filterByIri` adjacency is an acceptable first cut if 009 lands later; `ponytail:` note it);
  CE stubs with project-slice fixtures; two-tenant fixture for rule 6.

## Cost Estimate

- **Complexity:** L (packaging boundary + 7-rule verification + report plumbing)
- **Estimated tokens:** ~15k input, ~9k output (claude-sonnet-5)
- **Estimated cost:** ~$0.50

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (pin is normative; zero new endpoints)
- [x] Diagram references included
- [x] Design decisions noted (LOCKED-pin escalation rule explicit)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met; all 9 conformance tests green
- [ ] Conformance report artefact published in CI (the Build-M2 gate evidence)
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Lint passes; complexity within thresholds
- [ ] Zero axe-core violations on component states (empty/error/loading)
- [ ] Conventional commit(s); PR references this task and EPIC-021
- [ ] No implementation beyond the pin (no callbacks, no theming, no c4 stub code — YAGNI +
  stability rule)

## Implementation Hints

- The unsupported-mode error message should name the pin: "GE-CANVAS-1 M2 supports
  mode:\"force\" only (c4 is post-v1) — see ge-canvas-1.md".
- `useGraphLoad` scope filter: pass `filterByIri` into the SPARQL builder as a values-bound
  root; reuse the M1 pagination loop untouched.
- Rule 6 (tenant isolation) needs no component code — it's inherited from CE rewriter + proxy;
  the conformance test EXISTS to prove the component adds no bypass (e.g. no client-side cache
  keyed without tenant).
- The report generator is a tiny Playwright reporter (JSON writer) — no new dependency; wire
  it via the existing Playwright config's `reporter` array.
- Keep `CanvasCore` (the shared internals between Explorer shell and GraphCanvas) private —
  the exports test guards against it leaking.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

## Design Requirements

*Appended by the Weave design agent (Hook 1). Source bundle: R4 — Explorer canvas,
`docs/design/v1-design-requirements.md`. Every line below cites a token, JTBD entry, finding
(F-D-NNN), or requirement bundle (R-NN); uncited items are marked Advisory.*

### Regression — verify still holds (built at M1, must not regress when packaged)

| # | Requirement | Citation |
|---|---|---|
| D-1 | Regression: confirm fit-to-viewport (Cmd/Ctrl+0 and "Reset layout") and the corner-docked mini-map/zoom/fit chrome (bottom-right) still hold, unchanged, once `GraphCanvas` is packaged for standalone Build-host mounting (this brief's AC-4). | R4 ("corner-docked chrome... never floating mid-canvas"); `constitution-engine/m1/tasks/TASK-010.md` AC-4/AC-5 (the built baseline) |
| D-2 | Regression: confirm the per-expansion node cap / >500-node confirm-dialog gate still applies when `GraphCanvas` mounts inside a Build host route — the confirm gate is canvas-internal, not Explorer-shell-specific, so it must travel with the packaged component. | `docs/design/research/graph-canvas-ux-patterns.md` pattern 10 ("per-expansion node cap, separate global limit"); `constitution-engine/m1/tasks/TASK-013.md` AC-4 (the built baseline) |

### New scope — not yet built anywhere in M1

| # | Requirement | Citation |
|---|---|---|
| D-3 | `rdf:type` edges SHALL render hidden by default; named edges SHALL render labelled by their curie/label. | R4; F-D16 (Major — "Edge labels render the full raw IRI... `rdf:type` edges should be hidden by default"); F-D15 (Blocker) |
| D-4 | Stray/isolated nodes SHALL be handled by layout — no orphan floaters at seed scale. | R4; F-D15 (Blocker — "a stray node floats mid-canvas") |

### Gaps

- D-3 and D-4 were framed by the invoking brief as "already built at M1 — verify only," but the
  M1 canvas stylesheet (`constitution-engine/m1/tasks/TASK-010.md` `buildStylesheet`) sets edge
  labels to an unconditional empty string for **every** edge — it does not distinguish
  `rdf:type` from named edges, so the named-edge-labelling half of R4 was never actually
  specified at M1. Likewise, no M1 task brief (TASK-010/012/013) contains an isolated-node
  layout rule. Both are written above as **new scope**, not verify-only, so the acceptance
  lines aren't checked against a baseline that may not exist. Recommend the architect confirm
  against the actual M1 implementation (not just its brief) before treating either as a pure
  regression check, and confirm this task (rather than whichever owns the base canvas
  stylesheet/layout config) is the right place to land them if they're not already elsewhere.
