---
type: Task Brief
title: "Task: TASK-004 — Edit Controller + Write Proxy + Quick-Add Node + Draw Edge"
description: "CE-WRITE-1 write proxy with server-side principal_iri attribution (ADR-006);
  optimistic edit controller with 422/timeout rollback; double-click quick-add node;
  edgehandles drag-connect."
tags: [graph-explorer, arch, task, m2]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-005
milestone: M2
created: 2026-07-08
blocked_by: []
unlocks: [TASK-005, TASK-010]
adr_refs: [ADR-001-render-engine, ADR-006-edit-attribution-principal-iri]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-004 — Edit Controller + Write Proxy + Quick-Add + Draw Edge

## Story

**Epic:** [EPIC-005](../../../graph-explorer.md#epic-005--visual-editing-on-canvas--m2)
**Status:** Backlog · **Priority:** Must Have

**As a** BA or ontologist
**I want** to add nodes by double-clicking the canvas and draw edges by dragging between
nodes, with invalid edits clearly rejected
**So that** I can shape the draft operating model visually while the model can never become
invalid.

Covers: FR-019, FR-020 ([graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements)).
Delivers the **write proxy** (`POST /api/proxy/operations/apply`) and the **Edit Controller**
(optimistic apply + rollback) that TASK-005 (property edit / delete) and TASK-010 (GE-CANVAS-1
write-back) reuse.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN the write proxy receives a canvas edit, THE SYSTEM SHALL forward it to CE-WRITE-1 `POST /api/operations/apply` with `actor` set **server-side, verbatim** from the validated JWT `principal_iri` claim; IF the claim is missing THEN THE SYSTEM SHALL reject with 401 and no CE call. | `test_actor_from_principal_iri_claim`, `test_edit_rejected_without_principal_claim` |
| AC-2 | IF the request body contains any client-supplied `actor` field, THEN THE SYSTEM SHALL reject with 400 (spoof guard) — the proxy is the only writer of `actor`. | `test_spoofed_actor_body_rejected` |
| AC-3 | WHERE a BA/ontologist user is present on the draft canvas, WHEN the canvas is double-clicked THE SYSTEM SHALL optimistically render a new node (name + kind picker) and commit it via the write proxy (`add_node`). | `test_quick_add_optimistic_then_commit` |
| AC-4 | IF CE-WRITE-1 returns `422`, THEN THE SYSTEM SHALL remove the optimistic element and show the SHACL violations as human-readable text (focus node, path, message — never raw JSON). | `test_422_rollback_and_human_readable_shacl` |
| AC-5 | IF CE-WRITE-1 times out (default 10 s, tunable) or errors, THEN THE SYSTEM SHALL roll back the optimistic element leaving no orphan and show a retry notice. | `test_timeout_rollback_no_orphan` |
| AC-6 | WHEN an edgehandles drag releases on a valid target, THE SYSTEM SHALL optimistically render the edge (relationship-type picker from CE-READ-1 types) and commit via `add_edge`; self-loops SHALL be blocked at drag time. | `test_draw_edge_commit`, `test_self_loop_blocked` |
| AC-7 | WHERE the user's JWT role is `viewer`, or a published version is loaded, THE SYSTEM SHALL render no edit affordances — and the write proxy SHALL independently reject the write (server-side authz via CE-WRITE-1; UX hiding is never the security boundary). | `test_viewer_no_affordances`, `test_write_rejected_server_side_for_viewer` |
| AC-8 | WHEN a commit succeeds, THE SYSTEM SHALL reconcile the optimistic element with the CE response (real IRI replaces local ref) and record nothing client-side beyond canvas state (PROV-O + audit are CE-side). | `test_optimistic_ref_reconciled_to_iri` |

## Implementation

### Pseudocode

```
# ── Write proxy (Next.js API route — server-side) ─────────────────────────
POST /api/proxy/operations/apply:
  jwt = validateCognitoJwt(req)                     # JWKS; 401 on fail
  if req.body.actor is present: return 400          # AC-2 spoof guard
  principal = jwt.claims.principal_iri
  if !principal: return 401 { error: "no_principal" }   # AC-1 fail loud
  body = { operations: req.body.operations,
           actor: principal,                        # verbatim — never built from sub (ADR-006)
           target: "draft" }                        # M2: draft-only writes
  resp = POST ce/api/operations/apply (body, Bearer jwt, timeout config.ce_timeout_ms)
  return resp.status + resp.body                    # 201 | 422 | 5xx passthrough

# ── Edit Controller (client) — single owner of optimistic lifecycle ───────
function commitOp(op, optimisticEl, adapter, config):
  adapter.add(optimisticEl, { pending: true })
  resp = await writeProxy({ operations: [op] }, AbortSignal.timeout(config.ce_timeout_ms))
  if resp.status == 201:
    adapter.reconcile(optimisticEl, resp.applied)   # AC-8 ref → real IRI
  elif resp.status == 422:
    adapter.remove(optimisticEl)                    # AC-4
    showShaclViolations(humanise(resp.violations))  # "«label»: Process requires performedBy" style
  else:  # timeout / 5xx
    adapter.remove(optimisticEl)                    # AC-5 — no orphan
    toast("Edit failed — retry", action=() => commitOp(op, optimisticEl, adapter, config))

# ── Quick-add (AC-3) ───────────────────────────────────────────────────────
onDoubleClick(pos):
  if !canEdit(ctx): return                          # role + canvas-mode flag (AC-7 UX layer)
  { name, kind } = await quickAddPopover(pos, paletteKinds)   # kinds from CE-READ-1 types
  commitOp({ type: "add_node", ref: localRef(), label: name, kind }, ghostNode(pos), …)

# ── Draw edge (AC-6) ───────────────────────────────────────────────────────
edgehandles(config.edgehandles_params)              # prototype params, tunable
  .on("complete", (src, tgt) =>
    src == tgt ? block()                            # self-loop blocked at drag time
    : commitOp({ type: "add_edge", source: src.iri, target: tgt.iri,
                 predicate: await relTypePicker(paletteRels) }, ghostEdge(src, tgt), …))
```

### API Contracts

**`POST /api/proxy/operations/apply`** (new — this task; forwards CE-WRITE-1 per
[contracts.md §CE-WRITE-1](../../../../contracts.md))

Request (client → proxy): `{ "operations": [Op] }` — `actor` forbidden (400 if present),
`target` proxy-fixed to `"draft"` in M2. `Op` ∈ `add_node | update_node | add_edge |
delete_node | delete_edge` (CE-WRITE-1 op schema; new nodes carry local `ref`).

Responses (CE passthrough): `201 { activity_iri, applied_count, version_iri }` ·
`422 { violations: [{ focus_node, path, severity, message }] }` ·
`400` spoofed actor · `401` no/invalid JWT or missing `principal_iri` · `403` role not
permitted (CE-side) · `503` CE unavailable.
p95: ≤ 100 ms proxy overhead on CE's ≤ 800 ms write budget (m2-delta.md §4).

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Component delta | `../../tech-spec/m2-delta.md` | §6 | Edit Controller → CE-Write Proxy → CE-WRITE-1 path |
| Sequence | `../../tech-spec/business-process.md` | edit-commit flow (M1 doc: read flows; write flow mirrors spotlight fetch pattern with rollback) | Optimistic apply / rollback lifecycle |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| `actor` = JWT `principal_iri` claim, server-side, verbatim; spoof guard | [ADR-006](../../decisions/ADR-006-edit-attribution-principal-iri.md) | AC-1/AC-2 are the enforcement; invariants.md greps this handler |
| CE-WRITE-1 is the ONLY mutation path; SHACL validates on throwaway clone | contracts.md CE-WRITE-1 | No local validation beyond UX affordance checks — a "pre-validate" client SHACL pass is out of scope (and a fork risk) |
| Canvas handle-hiding is UX, never security | graph-explorer.md §2.2 Security | AC-7's second test asserts server-side rejection independent of UI state |
| Edgehandles prototype params | graph-explorer.md §Product Context | Port params from prototype into `config.edgehandles_params`; tunable |
| Draft-only writes in M2 | FR-019–022; ge-canvas-1.md rule 4 | Proxy pins `target: "draft"`; version-pinned canvas mode disables the controller (flag built in TASK-003 — coordinate if TASK-003 lands later: build the flag here if first) |

## Test Requirements

### Unit (minimum 5)

- `should set actor verbatim from principal_iri claim and never from sub`
- `should return 400 when request body carries an actor field`
- `should return 401 and make no CE call when principal_iri claim is missing`
- `should remove optimistic node and humanise violations on 422`
- `should remove optimistic edge on timeout leaving no orphan`

### Integration (minimum 3)

- `should commit add_node through proxy to CE-WRITE-1 stub and reconcile ref to returned IRI`
- `should block self-loop at drag time without any network call`
- `should reject write server-side for viewer JWT even when UI affordances are forced visible`

### E2E (minimum 2, Playwright — Law B: asserts backend state changed)

- `should double-click, name a node, and see it committed (CE stub state contains new node)`
- `should draw an edge between two nodes and see 422 SHACL violation rendered human-readably
  (stub configured to reject)`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Unit | claim + missing-claim tests |
| AC-2 | Unit | spoof-guard test |
| AC-3 | Integration + E2E | commit/reconcile + double-click E2E |
| AC-4 | Unit + E2E | 422 tests |
| AC-5 | Unit | timeout-rollback test |
| AC-6 | Integration + E2E | draw-edge + self-loop tests |
| AC-7 | Integration | viewer affordance + server-rejection tests |
| AC-8 | Integration | reconcile test |

## Dependencies

- **blocked_by:** none within M2 (consumes M1 canvas/adapter; builds its own proxy route).
  Coordinate with TASK-003 on the shared canvas-mode (read-only) flag — whichever lands first
  builds it.
- **unlocks:** TASK-005 (update/delete reuse controller + proxy), TASK-010 (GE-CANVAS-1
  write-back reuses both)
- **External:** CE-WRITE-1 stub with configurable 201/422/timeout behaviour; Cognito test JWTs
  with `principal_iri` + role claims (`viewer`, `BA`, `ontologist`); M1 gate passed.

## Cost Estimate

- **Complexity:** L (server route + security guards + optimistic lifecycle + two edit surfaces)
- **Estimated tokens:** ~16k input, ~10k output (claude-sonnet-5)
- **Estimated cost:** ~$0.55

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (proxy request/response, all error codes, p95)
- [x] Diagram references included
- [x] Design decisions noted (incl. ADR-006 enforcement points)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. the two security unit tests — non-negotiable)
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Lint passes; complexity within thresholds
- [ ] Zero axe-core violations on popovers/pickers
- [ ] Proxy overhead p95 ≤ 100 ms asserted in perf trace
- [ ] Edit Controller API documented for TASK-005/010 (docstring level)
- [ ] Conventional commit(s); PR references this task and EPIC-005
- [ ] No implementation beyond AC + pseudocode (no client-side SHACL, no `target` override)

## Implementation Hints

- `humanise(violations)`: render `message` per violation with the focus node's *label* (look
  up in loaded elements by IRI) — never print the focus-node IRI to non-ontologists (M1 IRI
  rule applies to error surfaces too).
- The optimistic ghost element must carry a visual pending state (design-token treatment from
  `docs/standards/design/`) so a slow commit is visible, not mysterious.
- Kind/relationship pickers read the palette already fetched at M1 boot (CE-READ-1
  `/api/ontology/types`) — no second types fetch.
- CE-WRITE-1 dedups case-insensitive `label`+`kind`: a duplicate quick-add reconciles to the
  existing node (201) — reconcile handles this identically; add a unit test if behaviour
  surprises (existing IRI returned for "new" node).
- Timeout uses `AbortSignal.timeout` (M1 pattern). The retry toast re-runs the SAME operation
  object — idempotency is CE-side (idempotency key optional; pass local `ref` through).

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
