---
type: Task Brief
title: "Task: TASK-005 — Side-Panel Property Edit + Delete Node/Edge + Concurrency Guard"
description: "Edit label/comment/typed props via CE-WRITE-1 update_node with a GE-side
  optimistic version-drift guard (no CE 409 exists); delete node/edge with reference warning
  and rollback-safe removal of exactly the submitted ops."
tags: [graph-explorer, arch, task, v1]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-005
milestone: v1
created: 2026-07-08
blocked_by: [TASK-004]
unlocks: [TASK-011]
adr_refs: [ADR-001-render-engine, ADR-006-edit-attribution-principal-iri, ADR-008-m2-concurrency-client-drift-guard]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-005 — Property Edit + Delete + Concurrency Guard

## Story

**Epic:** [EPIC-005](../../../graph-explorer.md#epic-005--visual-editing-on-canvas--m2)
**Status:** Backlog · **Priority:** Must Have

**As a** BA or ontologist
**I want** to edit a node's label, comment, and typed properties in the side panel, and delete
nodes or edges with a clear warning
**So that** I can maintain the draft model without ever producing an invalid or silently
corrupted graph.

Covers: FR-021, FR-022 ([graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements)).
Reuses TASK-004's Edit Controller and write proxy — this task adds `update_node`,
`delete_node`, `delete_edge` flows plus the concurrency guard. No new proxy routes.

> **Contract reality (pinned 2026-07-08, coordinator-confirmed):** CE-WRITE-1 returns ONLY
> `201 {activity_iri, applied_count, version_iri}` or `422 {violations}`. There is **no
> expected_version / 409 conditional write** and **no cascade beyond the submitted ops**.
> FR-021's original "LWW-with-version-check, else 409 notify" wording (since reworded in
> graph-explorer.md, ADR-008) is therefore implemented as a **GE-side optimistic drift guard**
> with conflict-notice UX. CE-WRITE-1 now records a **planned additive v1
> enhancement** — optional `expected_version` → `409 {current_version_iri}` — as the true
> server-side lost-update protection; cite it as the v1 upgrade path, do NOT depend on it or
> invent a bespoke guard for M2.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHERE a BA/ontologist has a draft node spotlighted, WHEN they save edited label/comment/typed props THE SYSTEM SHALL commit via the write proxy (`update_node`); CE writes PROV-O + PLAT-AUDIT-1 (actor per ADR-006 — proxy-injected, nothing client-side). | `test_update_node_commits_via_write_proxy` |
| AC-2 | WHEN edit mode opens, THE SYSTEM SHALL capture the current draft head (`version_iri` from the last CE-WRITE-1 response or graph-load state); WHEN save is attempted AND the draft head has advanced since capture, THE SYSTEM SHALL show a "graph changed since you started — review current values / reload" conflict notice with the current server value, and SHALL NOT commit until the user confirms against the fresh base. | `test_drift_guard_blocks_save_and_shows_current` |
| AC-3 | WHERE no drift is detected, concurrent edits to the same property resolve last-write-wins (both commits succeed as successive CE versions); the drift guard is best-effort protection, and its window SHALL be minimised by re-checking at save time (not only at edit-start). | `test_lww_when_no_drift_detected` |
| AC-4 | IF `update_node` returns `422`, THEN THE SYSTEM SHALL keep the panel in edit mode, show the SHACL violations human-readably, and leave the canvas element unchanged. | `test_update_422_keeps_edit_mode_canvas_unchanged` |
| AC-5 | WHEN delete is invoked on a node, THE SYSTEM SHALL first gather the node's FULL incident-edge set — **outbound AND inbound edges** — via CE-READ-1 (`GET /api/proxy/ontology/resource/{iri}`; IF that response carries outbound edges only, THE SYSTEM SHALL additionally fetch inbound edges via a `SELECT ?s ?p WHERE { ?s ?p <iri> }` on the existing sparql proxy) — not just edges in the loaded slice — show a warning naming the total reference count, and on confirm submit ONE batch containing a `delete_edge` op for every incident edge plus `delete_node` (CE enforces referential integrity via SHACL: a batch leaving dangling edges 422s whole). | `test_delete_batch_includes_incident_edges`, `test_delete_batch_includes_inbound_edges`, `test_delete_gathers_offslice_edges_via_ce_read` |
| AC-6 | WHEN a delete batch returns `201`, THE SYSTEM SHALL remove from the canvas exactly the IRIs of the ops GE submitted — nothing more, nothing inferred. | `test_delete_removes_exactly_submitted_ops` |
| AC-7 | IF a delete fails (`422`/timeout/5xx), THEN THE SYSTEM SHALL remove nothing from the canvas (no phantom-removal) and show a retry notice. | `test_delete_failure_removes_nothing` |
| AC-8 | WHERE the canvas is version-pinned or the JWT role is `viewer`, THE SYSTEM SHALL render no edit/delete affordances in the side panel; the server SHALL independently reject the write. | `test_panel_readonly_for_viewer_and_versions` |

## Implementation

### Pseudocode

```
# Reuses TASK-004: commitOp(op, …) with rollback; write proxy unchanged.

# Drift guard (AC-2/3) — GE-side; no CE contract change
function openEdit(node, ctx):
  ctx.editBase = ctx.draftHead            # version_iri GE already tracks (last 201 response
                                          # or graph-load state; TASK-007's poll also updates it)
  panel.enterEditMode(node)

async function savePanelEdits(node, edits, ctx):
  head = await currentDraftHead(ctx)      # cheap re-check at save time (see hint)
  if head != ctx.editBase:                # AC-2 drift
    current = await fetchNodeProps(node.iri)             # M1 fetch
    panel.showConflict({ yourValues: edits, serverValues: current })
    ctx.editBase = head                   # user reviews, may re-save against fresh base
    return
  resp = await writeProxy({ operations: [{ type: "update_node", iri: node.iri, set: edits }] })
  match resp.status:
    201 → panel.showSaved(); adapter.updateData(node, edits); ctx.draftHead = resp.version_iri
    422 → panel.stayInEditMode(); showShaclViolations(humanise(resp.violations))   # AC-4
    _   → panel.stayInEditMode(); toast("Save failed — retry")

# Delete (AC-5..7) — GE composes the FULL batch; CE does not cascade
function requestDelete(el, adapter):
  incident = el.isNode
    ? union((await fetchNodeProps(el.iri)).edges,        # CE-READ-1 — FULL set; loaded slice may
            await fetchInboundEdges(el.iri))             # miss off-canvas edges (filters,
                                                         # pagination). Inbound (?s ?p <iri>) via
                                                         # the sparql proxy IF resource/{iri} is
                                                         # outbound-only — AC-5; dedupe by
                                                         # (source, predicate, target)
    : []
  ok = await confirmDialog(incident.length > 0
        ? `Deleting removes ${incident.length} connection(s). Continue?` : "Delete?")
  if !ok: return
  ops = el.isNode
    ? incident.map(e => ({ type: "delete_edge", source: e.source, target: e.target,
                           predicate: e.predicate }))
      .concat([{ type: "delete_node", iri: el.iri }])
    : [{ type: "delete_edge", … }]
  resp = await writeProxy({ operations: ops })
  if resp.status == 201:
    adapter.remove(irisOf(ops))           # AC-6 — exactly what we submitted
    ctx.draftHead = resp.version_iri
  else:
    toast("Delete failed — retry")        # AC-7 — canvas untouched (422 shows violations)
```

### API Contracts

No new endpoints — `POST /api/proxy/operations/apply` (TASK-004) with ops `update_node`,
`delete_node`, `delete_edge` per [contracts.md §CE-WRITE-1](../../../../contracts.md).
Responses used: `201 {activity_iri, applied_count, version_iri}` · `422 {violations}` — the
complete contract surface; this task depends on nothing beyond it. Drift detection reads the
draft head GE already tracks (graph-load / last 201 / TASK-007 poll); at worst one
versions-family head check at save time.

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Component delta | `../../tech-spec/m2-delta.md` | §6 | Edit Controller → write proxy path this task extends |
| State | `../../tech-spec/business-process.md` | side-panel states | M1 panel state machine gaining edit/conflict states |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| Concurrency = GE-side optimistic drift guard for M2; server-side guard is CE-WRITE-1's planned additive v1 `expected_version` → `409 {current_version_iri}` | ADR-008; contracts.md CE-WRITE-1 (pinned 2026-07-08) | FR-021's "409" is UX language in M2; at v1, swap the drift re-check for the real conditional write — no bespoke guard meanwhile |
| Delete batch composed by GE from the FULL CE-READ-1 incident set; CE validates referential integrity, never cascades | contracts.md CE-WRITE-1 | A batch missing an off-slice edge 422s whole — the pre-delete read is correctness, not optimisation. Canvas removals = submitted op IRIs ∩ loaded elements |
| Actor attribution proxy-side | ADR-006 | Client code never touches actor |
| Handle-hiding is UX, not security | graph-explorer.md §2.2 | AC-8 dual assertion, same as TASK-004 AC-7 |

## Test Requirements

### Unit (minimum 6)

- `should block save and show server values when draft head advanced since edit-start`
- `should commit last-write-wins when no drift detected at save time`
- `should compose delete batch of node plus all incident edges from the CE-READ-1 fetch`
- `should include inbound edges (edges pointing AT the node) in the delete batch`
- `should include off-slice incident edges (CE fetch returns more edges than loaded) in the batch`
- `should remove exactly the submitted op IRIs from canvas on 201`
- `should stay in edit mode with humanised violations on 422`

### Integration (minimum 3)

- `should surface conflict notice to second writer when stub head advances between edits`
- `should show reference-count warning and commit delete only after confirm`
- `should leave canvas untouched when delete stub times out`

### E2E (minimum 2, Playwright — backend state asserted)

- `should edit a node label and see it persisted (stub state updated, PROV activity recorded)`
- `should delete a node with edges after warning and see node + incident edges gone from stub state`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Unit + E2E | commit + label E2E |
| AC-2 | Unit + Integration | drift tests |
| AC-3 | Unit | LWW no-drift test |
| AC-4 | Unit | 422 edit-mode test |
| AC-5 | Unit + Integration | batch-composition + off-slice-gather + warning tests |
| AC-6 | Unit + E2E | exact-removal + cascade E2E |
| AC-7 | Integration | timeout-untouched test |
| AC-8 | Integration | reuse TASK-004 pattern against panel affordances |

## Dependencies

- **blocked_by:** [TASK-004 (Edit Controller + write proxy)] — unchanged by the reframe
- **unlocks:** TASK-011; optionally enriches TASK-008 (E10-S2 inline edit shortcut)
- **Soft:** TASK-007's poll keeps `draftHead` fresher (narrower drift window) — beneficial,
  not required; the save-time re-check works standalone
- **External:** CE-WRITE-1 stub (201/422/timeout) with an advanceable head fixture; test JWTs.

## Cost Estimate

- **Complexity:** M (three ops + drift/confirm UX on existing controller)
- **Estimated tokens:** ~12k input, ~7k output (claude-sonnet-5)
- **Estimated cost:** ~$0.35

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (complete CE-WRITE-1 surface; no invented fields)
- [x] Diagram references included
- [x] Design decisions noted (contract-reality pin explicit)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Lint passes; complexity within thresholds
- [ ] Zero axe-core violations (edit form, conflict + confirm dialogs — focus-trap correct)
- [ ] Conventional commit(s); PR references this task and EPIC-005
- [ ] No implementation beyond AC + pseudocode (no bulk edit, no undo stack, no CE
  conditional-write dependency — YAGNI)

## Implementation Hints

- `currentDraftHead`: prefer the head GE already holds (updated by every 201 and by TASK-007's
  poll when present); only fall back to a versions head-check request if local state is stale
  by more than the poll interval. `# ponytail: local head + save-time re-check; a CE HEAD/
  conditional-write ask only if the drift window proves too wide in practice`
- Conflict notice shows the CURRENT server value next to the user's pending value — form-
  conflict component from the design system (`docs/standards/design/`).
- Delete-batch ordering: edges before node (edges reference the node); one batch, one
  transaction, one PROV activity.
- The pre-delete CE-READ-1 fetch is the SAME `fetchNodeProps` call the M1 side panel uses —
  reuse it; the warning count comes from that response, never from `adapter.incidentEdges`
  (which only sees the loaded slice).
- On 201, remove submitted IRIs ∩ loaded elements — off-slice edges were never on canvas.
- Typed props editing: render inputs by datatype from `key_properties` (string/number/date);
  unknown datatypes render read-only in M2 (`ponytail:` full datatype coverage when a PRD asks).
- Confirm + conflict dialogs keyboard-first (Enter confirms, Esc cancels), focus-trapped.
- Edge delete needs no reference warning (refs = 0 path) — straight confirm.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
