---
type: Task Brief
title: "Task: TASK-026 — Saved Views UI + Share + Comments + Live-Refresh Poll"
description: "Views panel (save/load/library/featured pins), share flow via the persistence
  service, comments panel on nodes and views, and the live-refresh poll of the CE-EVENT-1 beta
  seq feed (GET /api/events?since_seq={n})."
tags: [graph-explorer, arch, task, v1]
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-018
milestone: v1
created: 2026-07-08
blocked_by: [TASK-020, TASK-025]
unlocks: [TASK-030]
adr_refs: [ADR-014-render-engine]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-026 — Saved Views UI + Share + Comments + Poll Refresh

## Story

**Epic:** [EPIC-018](../../../constitution-engine.md#epic-018--async-share--comments--m2) +
[EPIC-019](../../../constitution-engine.md#epic-019--saved-views--layout--m2) (UI)
**Status:** Backlog · **Priority:** Must Have

**As a** workshop facilitator
**I want** to save the exact canvas state as a named view, share it, discuss it in comments,
and see the canvas refresh as the model changes
**So that** my team collaborates asynchronously on one shared lens instead of screenshots.

Covers UI of: FR-023, FR-024, FR-025, FR-028, FR-029, FR-030
([constitution-engine.md §6.1](../../../constitution-engine.md#61-functional-requirements)).
All server behaviour is TASK-025's; this task is panels + canvas wiring + poll loop.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN a user saves a view, THE SYSTEM SHALL capture FilterState (TASK-020), active overlays (TASK-021/022), domain focus, viewport, and current node positions, require a name, and POST to `/api/views`; ON `409` collision THE SYSTEM SHALL prompt overwrite / rename. | `test_save_captures_full_state_and_handles_collision` |
| AC-2 | WHEN a saved view is opened (own, library, or via share link), THE SYSTEM SHALL reproduce the canvas exactly: filters, overlays, domain focus, viewport, and the snapshot layout (`view:{id}` positions applied before fcose). | `test_open_view_reproduces_state_and_layout` |
| AC-3 | IF a saved view references entities that no longer exist in the draft graph, THEN THE SYSTEM SHALL load the view, flag the missing entities in a notice ("N entities in this view no longer exist"), and render the rest. | `test_missing_entities_flagged_on_load` |
| AC-4 | WHEN the library panel opens, THE SYSTEM SHALL list the tenant's views with featured (pinned) views shown first; delete SHALL be offered only where the API allows (creator's own; tenant admin any) and confirmed before call. | `test_library_featured_first_delete_affordance_matrix` |
| AC-5 | WHEN a user shares a view, THE SYSTEM SHALL let them pick recipients from the tenant member list, call the share endpoint, and show "notified N (M excluded)" from the response — never the excluded identities. | `test_share_flow_shows_counts_not_identities` |
| AC-6 | WHEN a comment is submitted on a node or view, THE SYSTEM SHALL persist via `/api/comments` and render it in the comments panel (author display name, relative time); comments on the spotlighted node SHALL be reachable from the side panel. | `test_comment_submit_and_render_on_node_and_view` |
| AC-7 | WHILE the draft canvas is open, THE SYSTEM SHALL poll the CE-EVENT-1 beta seq feed via `GET /api/proxy/events?since_seq={cursor}` (default 30 s, tunable) — draft commits arrive as `version_iri: null` rows — and, on new events, refresh the affected elements in place WITHOUT blocking interaction or discarding unsaved drag state; IF the cursor is aged out (`410 Gone`) THEN THE SYSTEM SHALL re-baseline via a full CE-READ-1 reload (never a silent empty page); polling SHALL pause while a published version or diff is displayed. | `test_poll_refresh_nonblocking_preserves_drag`, `test_poll_410_rebaselines_via_ce_read`, `test_poll_paused_on_version_view` |
| AC-8 | WHERE panels render, THE SYSTEM SHALL produce zero axe-core violations and be keyboard-operable (save dialog, library, share picker, comment composer). | `test_panels_axe_clean_keyboard` |

## Implementation

### Pseudocode

```
# Save (AC-1)
function saveView(name, overwrite=false):
  body = { name, overwrite,
           definition: { filterState, activeOverlayIds, domainFocus, viewport: adapter.getViewport() },
           positions: adapter.allNodePositions() }        # client sends drag-state (TASK-025 hint)
  resp = POST /api/views
  if resp.status == 409: prompt overwrite → saveView(name, true) | rename → dialog stays

# Open (AC-2/3)
function openView(view):
  d = view.definition
  positions = GET /api/layout/positions?graph_id=view:{view.id}     # M1 endpoint, view scope
  reloadGraph(draft)                                                # M1 loader
  missing = d-referenced IRIs (filter values, domain focus, position rows) not in loaded graph
  if missing.nonEmpty(): notice(`${missing.length} entities no longer exist`)   # AC-3
  adapter.applyPositions(positions, before=fcose)                   # M1 mechanism
  applyFilterState(d.filterState); overlayEngine.activateAll(d.activeOverlayIds)
  adapter.setViewport(d.viewport)

# Poll refresh (AC-7) — CE-EVENT-1 beta seq feed (contracts.md: the seq feed IS the polled
# transport; there is NO "since-version" filter on CE-READ-1)
cursor = latest_seq from initial GET /api/proxy/events?since_seq=0&limit=1  # baseline at load
loop every config.poll_interval_ms while canvasCtx.mode == "draft":
  resp = GET /api/proxy/events?since_seq={cursor}
  if resp.status == 410:                       # cursor aged out (30-day retention)
    reloadGraph(draft); cursor = resp.latest_seq ?? re-baseline call   # CE-READ-1 re-baseline
    continue
  cursor = resp.latest_seq
  changed = resp.events.map(e => e.entity_iri)          # draft rows have version_iri: null
  if changed.nonEmpty():
    delta = reload changed elements (paginated loader)
    adapter.mergeInPlace(delta, preserve = unsavedDragPositions)    # never a full blank reload
    ctx.draftHead = latest draft-commit marker           # narrows TASK-024's drift window
```

### API Contracts

Consumes TASK-025 endpoints (shapes + errors there) and the M1 layout endpoint with the
`view:{id}` scope. Poll uses `GET /api/proxy/events` → CE-EVENT-1 seq feed (m2-delta-explorer.md §3;
event shape + `410` semantics are contracts.md §CE-EVENT-1 — cited, not restated). On poll CE
error (non-410): keep current canvas, retry next tick (never an error takeover — FR-025
"without blocking").

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Component delta | `../../tech-spec/m2-delta-explorer.md` | §6 | Views/Comments panels → Persistence Service; poll via read proxy |
| Sequence | `../../tech-spec/business-process-explorer.md` | graph-load flow | Loader reused by openView and poll merge |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| Saved view = definition JSONB + layout snapshot rows | m2-delta-explorer.md §2 | FilterState must serialise verbatim (TASK-020 DoD guarantees it) |
| Live refresh = poll of the CE-EVENT-1 beta seq feed; push fan-out post-v1 | contracts.md CE-EVENT-1; invariants-explorer.md | The seq feed IS the polled transport — no bespoke "since-version" read invented; no push/WebSocket consumer in M2 (invariant grep) |
| Share reveals counts, never excluded identities | FR-023/E6-S1 | UI renders response numbers only |
| Poll pauses on version/diff view | FR-025 + TASK-022 mode flag | One subscription to canvas-mode; no second flag |

## Test Requirements

### Unit (minimum 4)

- `should serialise full canvas state into save body`
- `should compute missing-entity set on view open`
- `should merge poll delta preserving unsaved drag positions`
- `should re-baseline via full reload when the events cursor returns 410`
- `should pause poll when canvas mode is version or diff`

### Integration (minimum 3)

- `should round-trip save → open reproducing filters, overlays, viewport, layout (service + stub CE)`
- `should render comments for node and view targets from service`
- `should show overwrite/rename prompt on 409 and succeed on overwrite`

### E2E (minimum 2, Playwright — Law B)

- `should save a view as user A and reproduce identical canvas as user B in the same tenant`
- `should comment on a spotlighted node and see it appear for another session`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Unit + Integration | serialise + 409 tests |
| AC-2 | Integration + E2E | round-trip + two-user E2E |
| AC-3 | Unit | missing-entity test |
| AC-4 | Integration | library matrix test |
| AC-5 | Unit | counts-not-identities test |
| AC-6 | Integration + E2E | comment tests |
| AC-7 | Unit | poll merge + 410 re-baseline + pause tests |
| AC-8 | CI axe + E2E | keyboard panels |

## Dependencies

- **blocked_by:** [TASK-020 (FilterState + panel shell), TASK-025 (all endpoints)]
- **unlocks:** TASK-030
- **External:** TASK-021/022 overlay ids must be stable strings (they are — engine
  registration ids); CE-EVENT-1 seq-feed stub with advancing `seq`, `version_iri: null` draft
  rows, and a `410` fixture for the re-baseline test.

## Cost Estimate

- **Complexity:** L (state capture/restore fidelity + poll merge are fiddly)
- **Estimated tokens:** ~15k input, ~9k output (claude-sonnet-5)
- **Estimated cost:** ~$0.50

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (consumes TASK-025; no new routes; poll error rule)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (two-user E2E is the M2 exit-criterion rehearsal)
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Lint passes; complexity within thresholds
- [ ] Zero axe-core violations on all four panels/dialogs
- [ ] Conventional commit(s); PR references this task and EPIC-018/EPIC-019
- [ ] No implementation beyond AC + pseudocode (no comment threads/reactions, no view
  history, no share-to-external — YAGNI)

## Implementation Hints

- View-open ordering matters: positions BEFORE fcose (M1 rule), filters/overlays AFTER graph
  load, viewport LAST — otherwise fcose fights the viewport restore.
- Poll merge must not re-run fcose for unchanged nodes: apply delta elements with saved/current
  positions and only layout genuinely new nodes (`ponytail:` full incremental layout only if
  new-node clustering looks bad).
- Author display name: the comments API returns principal IRIs; resolve display names from the
  tenant member list already available to the SPA shell — never render a raw principal IRI
  (M1 IRI-hiding rule extends here).
- Relative timestamps: use the platform-standard util (SPA shell has one); no new date lib
  (Law A / ladder rung 2).
- Share picker lists tenant members (PLAT-SETTINGS-1-backed member list from the shell);
  eligibility is SERVER-decided — the picker does not pre-filter beyond tenant membership.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
