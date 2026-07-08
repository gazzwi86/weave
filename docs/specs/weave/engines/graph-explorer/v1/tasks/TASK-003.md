---
type: Task Brief
title: "Task: TASK-003 — Versions Panel + Diff Overlay (CE-VERSION-1 / CE-DIFF-1)"
description: "Versions panel listing published versions, read-only version load, two-version
  compare applying the diff overlay (added/removed/modified incl. edge modifications), JSON
  summary export."
tags: [graph-explorer, arch, task, v1]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-008
milestone: v1
created: 2026-07-08
blocked_by: [TASK-002]
unlocks: [TASK-011]
adr_refs: [ADR-001-render-engine]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-003 — Versions Panel + Diff Overlay

## Story

**Epic:** [EPIC-008](../../../graph-explorer.md#epic-008--version-views--diff--m2) (+ E4-S2 of
[EPIC-004](../../../graph-explorer.md#epic-004--visual-overlays--m2))
**Status:** Backlog · **Priority:** Must Have

**As a** compliance analyst
**I want** to view the graph as any published version (read-only) and see a visual diff
between two versions
**So that** I can audit exactly what changed in the operating model between releases.

Covers: FR-016, FR-031, FR-032 ([graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements)).
Export is **JSON only in M2** (OQ-06 closed — m2-delta.md §1).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN the Versions panel opens, THE SYSTEM SHALL list published versions via CE-VERSION-1 (`GET /api/proxy/ontology/versions`) with semver, published date, and a `latest` marker; the default canvas SHALL remain **draft**. | `test_versions_panel_lists_via_ce_version_1` |
| AC-2 | WHEN a published version is selected, THE SYSTEM SHALL reload the canvas via CE-READ-1 pinned to that `version_iri`, read-only: every edit affordance (quick-add, edgehandles, side-panel edit, delete) SHALL be absent or disabled while a version is loaded. | `test_version_load_read_only_no_edit_affordances` |
| AC-3 | WHEN two published versions are selected for compare, THE SYSTEM SHALL call CE-DIFF-1 (`GET /api/proxy/ontology/diff?from&to`) and apply the diff overlay: added = green, removed = red at 0.35 opacity (tunable), modified (including **edge modifications**) = amber. | `test_diff_overlay_added_removed_modified_incl_edges` |
| AC-4 | WHEN the two selected versions are identical (or CE-DIFF-1 returns an empty diff), THE SYSTEM SHALL show a "no differences" banner and apply no overlay. | `test_identical_versions_no_differences_banner` |
| AC-5 | IF CE-DIFF-1 errors or times out (10 s default, tunable), THEN THE SYSTEM SHALL show a retry banner and leave the existing canvas unchanged. | `test_diff_error_retry_banner_canvas_unchanged` |
| AC-6 | WHEN a diff is displayed, THE SYSTEM SHALL offer a JSON summary export (the CE-DIFF-1 response plus `{from, to, generated_at}` envelope); no PDF/CSV option SHALL be present in M2. | `test_json_export_shape_no_pdf_csv` |
| AC-7 | WHERE the diff overlay is active, THE SYSTEM SHALL register it in the Overlay Engine's exclusive colour group (heatmap disabled while diff is active, and vice versa). | `test_diff_registers_exclusive_with_heatmap` |
| AC-8 | WHEN returning to draft from a version or diff view, THE SYSTEM SHALL restore the draft canvas, prior colouring, and edit affordances (role-appropriate). | `test_return_to_draft_restores_state` |

## Implementation

### Pseudocode

```
# Versions panel
function loadVersions(jwt, config):
  resp = GET /api/proxy/ontology/versions (Bearer jwt, timeout config.ce_timeout_ms)
  if error: showPanelError(retry); return
  render(rows sorted by published_at desc, latestBadge on is_latest)   # AC-1

function selectVersion(version_iri):
  canvasCtx.mode = { kind: "version", version_iri }                    # global read-only flag
  reloadGraph(version_iri)                # M1 paginated load, version param passed through
  editController.disable()                # AC-2 — single flag all edit surfaces check

# Diff (Overlay registered in TASK-002 engine, exclusiveGroup "colour")
function compare(from_iri, to_iri, jwt, config):
  resp = GET /api/proxy/ontology/diff?from&to (timeout)
  if error/timeout: showRetryBanner(); return                          # AC-5 — canvas untouched
  if resp.added/removed/modified all empty: showBanner("no differences"); return  # AC-4

  # CE ADR-002: flat RDF triples; GE derives node/edge grouping CLIENT-SIDE
  grouped = groupTriples(resp)   # triple.predicate ∈ relationship predicates ⇒ edge, else node-prop
  overlayEngine.activate(diffOverlay(grouped), adapter, config)        # AC-3/AC-7
  #   added nodes/edges → green; removed → ghost-rendered red @ 0.35; modified (incl. edge
  #   modifications: Modification whose predicate is a relationship predicate) → amber
  exportButton.enable(() => downloadJson({ from, to, generated_at: now(), ...resp }))  # AC-6

function groupTriples(diff):
  relPreds = config.relationship_predicates   # from CE-READ-1 /api/ontology/types at boot
  edgeChange(t) = relPreds.has(t.predicate)
  return { nodes: {...}, edges: partition by edgeChange over added/removed/modified }
```

### API Contracts

**`GET /api/proxy/ontology/versions`** (CE-VERSION-1 forward — new proxy route, this task)
Response `200`: `[{ "version_iri", "semver", "published_at", "is_latest" }]`
Errors: 401 unauthorised · 503 store unavailable. p95 ≤ 200 ms (m2-delta.md §4).

**`GET /api/proxy/ontology/diff?from=<iri>&to=<iri>`** (CE-DIFF-1 forward — new proxy route)
Response `200`:

```json
{
  "added":    [{ "subject": "...", "predicate": "...", "object": "..." }],
  "removed":  [{ "subject": "...", "predicate": "...", "object": "..." }],
  "modified": [{ "subject": "...", "predicate": "...", "before": "...", "after": "..." }]
}
```

Errors: 400 unknown version IRI · 401 · 503. Proxy overhead p95 ≤ 100 ms on CE's diff budget.
Shape is canonical in CE `schemas/ontology.py::DiffResponse` (CE ADR-002) — flat triples;
node/edge grouping is client-side; never request a server-side grouped view (contract note).

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Component delta | `../../tech-spec/m2-delta.md` | §6 | Versions Panel + Diff/Version proxy edges |
| Sequence | `../../tech-spec/business-process.md` | version/graph-load flow | M1 paginated load the version reload reuses |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| Diff is server-computed (CE-DIFF-1); GE only renders | graph-explorer.md §2.5 | No client-side diffing of two loaded graphs — ever |
| CE-DIFF-1 returns flat triples; consumer derives grouping | contracts.md CE-DIFF-1 (2026-07-05 amendment) | `groupTriples` is GE code; edge-vs-prop classification keys on the relationship-predicate set from CE-READ-1 types (config, not literals) |
| Published versions are read-only everywhere | PRD constraint; ge-canvas-1.md rule 4 | One canvas-mode flag; every edit surface checks it — no per-component ad-hoc checks |
| OQ-06: JSON-only export in M2 | m2-delta.md §1 | No PDF/CSV code paths; invariants.md greps for their absence |
| Diff ⟷ heatmap mutual exclusion | FR-015/FR-016 | Register via TASK-002 engine `exclusiveGroup: "colour"` — no bespoke lockout |

## Test Requirements

### Unit (minimum 4)

- `should group flat diff triples into node and edge changes using config relationship predicates`
- `should classify a modified relationship triple as an edge modification (amber)`
- `should produce export JSON with from/to/generated_at envelope and raw diff body`
- `should keep canvas state untouched when diff response is an error`

### Integration (minimum 3)

- `should list versions from CE-VERSION-1 stub with latest marker`
- `should render no-differences banner when CE-DIFF-1 stub returns empty arrays`
- `should reload canvas version-pinned and read-only when a version is selected`

### E2E (minimum 2, Playwright)

- `should select two versions, see green/red/amber overlay incl. an edge modification, export JSON`
- `should load a published version, find no edit affordances, return to draft and edit again (BA role)`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Integration | versions-list test |
| AC-2 | Integration + E2E | read-only tests |
| AC-3 | Unit + E2E | grouping/edge-mod + overlay E2E |
| AC-4 | Integration | no-differences test |
| AC-5 | Unit | error-untouched test |
| AC-6 | Unit + E2E | export tests |
| AC-7 | Unit | `test_diff_registers_exclusive_with_heatmap` (engine registration) |
| AC-8 | E2E | return-to-draft E2E |

## Dependencies

- **blocked_by:** [TASK-002 (Overlay Engine — diff overlay registers into it)]
- **unlocks:** TASK-011 (release-gate suite covers version/diff paths)
- **External:** CE-DIFF-1 + CE-VERSION-1 stubs with fixtures including at least one edge
  modification; the M1 graph loader must accept a `version` parameter (it does — CE-READ-1
  `?version=`).

## Cost Estimate

- **Complexity:** M-L (two proxy routes, canvas mode flag, triple grouping, overlay)
- **Estimated tokens:** ~14k input, ~8k output (claude-sonnet-5)
- **Estimated cost:** ~$0.42

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (both new proxy routes with shapes, errors, p95)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Lint passes; complexity within thresholds
- [ ] Zero axe-core violations on panel + banners
- [ ] Proxy p95 targets asserted in perf trace (versions ≤ 200 ms; diff overhead ≤ 100 ms)
- [ ] Conventional commit(s); PR references this task and EPIC-008
- [ ] No implementation beyond AC + pseudocode (YAGNI — no PDF/CSV, no server-side grouping ask)

## Implementation Hints

- The read-only canvas mode flag is the SAME mechanism ge-canvas-1.md rule 4 needs (version ⇒
  forced readonly). Build it as one context value; TASK-010 will consume it — do not duplicate.
- Removed elements aren't in the loaded draft graph: render them as ghost elements added by the
  overlay (red, 0.35 opacity), and remove the ghosts on overlay deactivation — snapshot/restore
  via the TASK-002 engine handles colour, but ghost element cleanup is the diff overlay's
  `remove()`.
- `Modification.before/after` are object VALUES for a subject+predicate pair (CE ADR-002) —
  an edge retarget appears as a modification whose predicate is a relationship predicate.
  Confirmed 2026-07-08: CE-DIFF-1 emits **no reification quads** — flat triples only — so the
  relationship-predicate classification rule is complete; no second grouping rule needed.
- Version list may be long: render newest-first, no pagination in M2 (CE-VERSION-1 lists are
  small); add a `ponytail:` note if you cap display length.
- Design tokens for green/red/amber come from `docs/standards/design/data-viz.md` diff tokens —
  no raw hex.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
