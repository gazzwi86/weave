---
type: Task
title: "Task: TASK-018 — Run-Log Sink + Task Detail 5-Tab Panel (FR-019/FR-020)"
description: "Net-new orchestrator run-log sink (NDJSON to S3, log_location_ref pointer), the
  net-new 8-state visual capture producer in the QA/ASSESS lane (nothing in M1/M2 produces the
  captures manifest — without it the Tests tab is permanently hollow), and the Task Detail
  panel: Brief / Handoff / Tests / Console / Audit tabs with the honest 'audit unavailable'
  state."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-005
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-010]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-018.md
---

# Task: TASK-018 — Run-Log Sink + Task Detail 5-Tab Panel (FR-019/FR-020)

## Story

**Epic:** [EPIC-005 — Task Brief & Detail](../../../build-engine.md#epic-005)
**Status:** Backlog · **Priority:** Must Have

**As a** technical architect reviewing dark-factory work
**I want** one panel showing a task's brief, handoff summaries, test evidence, console log,
and audit trail
**So that** I can judge a task's history without assembling it from five systems

> **FRs covered:** FR-019 (five tabs), FR-020 (8 visual-state captures; read-only Audit tab).
> Includes TWO net-new producers, because both tabs would otherwise have no data source:
> the **Run-Log Sink** (M1 emits Python logging only — verified in `build/orchestrator.py`;
> nothing persisted per run → Console tab needs it) and the **visual-state capture producer**
> (verified: nothing in the M1/M2 pipeline writes `captures/manifest.json` → the Tests tab
> captures grid needs it; v1-delta §2 bullet).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a run executes, THE SYSTEM SHALL write structured NDJSON log lines to S3 and set `generation_runs.log_location_ref` at run end; a sink failure is a disclosed warning, never a run failure | `should persist run log and set location ref` |
| AC-2 | WHEN the Task Detail opens, THE SYSTEM SHALL render Brief / Handoff / Tests / Console / Audit tabs, tab switch ≤ 200 ms; Brief renders the typed YAML brief, Handoff renders predecessors' dep summaries | `should render five tabs from task detail payload` |
| AC-3 | WHEN the Tests tab renders a UI-bearing task, THE SYSTEM SHALL show the 8 visual-state captures (default/hover/focus/active/disabled/loading/empty/error) from `{output_location_ref}/captures/manifest.json`; a missing manifest shows "captures not available", never broken images | `should render eight capture states or honest absence` |
| AC-4 | WHEN the Console tab opens for a live run, THE SYSTEM SHALL tail via the existing run-status pub/sub; for a finished run it SHALL read the S3 log by `log_location_ref`; absent pointer ⇒ "log not captured" | `should read console from pubsub live and s3 when finished` |
| AC-5 | WHEN the Audit tab cannot reach PLAT-AUDIT-1, THE SYSTEM SHALL show "audit unavailable" and never fabricate entries | `should show audit unavailable when PLAT-AUDIT-1 unreachable` |
| AC-6 | WHEN a task links an ADR/decision in its brief, THE SYSTEM SHALL resolve the link to the corresponding Decision Log record (E7 AC) | `should link brief decision to decision log record` |
| AC-7 | WHEN the QA/ASSESS lane runs for a UI-bearing task, THE SYSTEM SHALL capture the 8 visual states (default/hover/focus/active/disabled/loading/empty/error) of the task's primary UI surface via the existing Playwright lane, writing `{output_location_ref}/captures/{state}.png` + `manifest.json`; a state the surface cannot exhibit is listed in the manifest as `absent` with a reason; non-UI tasks write no manifest (AC-3 renders honest absence); a capture failure is a disclosed warning, never an ASSESS failure | `should write captures manifest for ui task during assess` |

## Implementation

### Pseudocode

```
# sink (orchestrator):
class RunLogSink:                          # constructed per run beside the emitter
    def emit(self, event: dict): buffer.append(ndjson(event))     # PDAC steps, gates, retries
    def close(self):                        # run end (any terminal status)
        try: s3.put(f"{artefact_prefix}/{run_id}/run.ndjson", buffer)
             repo.generation_runs.set_log_ref(run_id, uri)         # AC-1
        except S3Error: log.warning("run_log_persist_failed", ...)  # disclosed, non-fatal

# capture producer (QA/ASSESS lane, UI-bearing tasks only — AC-7):
function capture_visual_states(task, run):            # after the task's Playwright lane passes
    if not task.has_ui_surface: return                # no manifest — honest absence (AC-3)
    entries = []
    for state in [default, hover, focus, active, disabled, loading, empty, error]:
        try: png = playwright.capture(task.primary_surface, state)
             s3.put(f"{run.output_location_ref}/captures/{state}.png", png)
             entries.append({state, "captured"})
        except StateNotExhibited as e: entries.append({state, "absent", reason: e})
    s3.put(f"{run.output_location_ref}/captures/manifest.json", entries)
    # any capture-step crash -> run_log.warning("captures_failed"), ASSESS verdict unaffected

# endpoint:
GET /api/projects/{id}/tasks/{task_id}:
    return {brief: task_briefs row (typed YAML), handoff: dep_summaries of blocked_by,
            tests: gate/test evidence rows + captures_manifest_ref,
            console: {live: sse_channel | ref: log_location_ref | null},
            audit_ref: filter params for the audit read}
GET /api/projects/{id}/tasks/{task_id}/audit:  proxy PLAT-AUDIT-1 filtered read
    on unreachable -> 503 {error: "audit_unavailable"}             # AC-5

# UI: /build/projects/[id]/tasks/[taskId] — <Tabs> five panes; captures = 8-cell grid
```

### API Contracts

`GET /api/projects/{id}/tasks/{task_id}` p95 ≤ 400 ms ·
`GET .../tasks/{task_id}/audit` p95 ≤ 800 ms (v1-delta §3). Errors: 403/404/500; audit route
adds 503 `audit_unavailable`. Consumes PLAT-AUDIT-1 (read-only), existing SSE pub/sub, S3 via
the M1 storage module.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 + Run-Log Sink bullet | Why S3-over-CloudWatch (Law F, no CW IAM in PM API) |
| Data model | `../../tech-spec/data-model.md` | §Task Briefs / §State Spine | Brief + dep-summary rows the tabs read |
| M1 run bundle | `../../tech-spec/data-model.md` | §Generation Runs Table | `output_location_ref` bundle the captures manifest lives in |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| NDJSON to S3, not a CloudWatch read path | `v1-delta.md` §2 | PM API needs no CW IAM; local tests stub S3 (Law F); one pointer column |
| Sink failure disclosed, never fatal | AC-1 | Log capture must not kill a run — same posture as cost-event insert (TASK-012 AC-6) |
| Captures manifest convention, no schema | `v1-delta.md` §4 note | `{output_location_ref}/captures/manifest.json`; the **producer is net-new in this task** (nothing in M1/M2 writes it — verified); rides the existing Playwright lane, no new browser infra |
| Capture failure never fails ASSESS | AC-7 | Same posture as the sink and cost-event insert: evidence capture is disclosed-best-effort, never a run gate |
| Audit tab is a filtered proxy, not a copy | FR-020 / PLAT-AUDIT-1 | Build never stores audit rows; unreachable = honest 503 |

## Test Requirements

### Unit Tests (minimum 4)

- `should persist run log and set location ref` (S3 stub)
- `should disclose and continue when run log persist fails`
- `should render eight capture states or honest absence` (component, both manifest cases)
- `should link brief decision to decision log record`

### Integration Tests (minimum 4)

- `should write captures manifest for ui task during assess` (loop fixture with stub
  Playwright lane; asserts manifest content incl. an `absent` state — Law B backend assertion)
- `should read console from pubsub live and s3 when finished` (both source paths)
- `should show audit unavailable when PLAT-AUDIT-1 unreachable` (stub down — Law B assertion
  on the 503 body)
- `should return task detail payload with brief and handoff` (seeded brief + dep summaries)

### E2E Tests (Playwright, minimum 1)

- `should open task detail from kanban card and switch all five tabs` (tab switch budget
  asserted; audit tab against stub)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Unit | `should persist run log and set location ref` |
| AC-2 | Integration + E2E | `should return task detail payload with brief and handoff` / E2E tab flow |
| AC-3 | Unit | `should render eight capture states or honest absence` |
| AC-4 | Integration | `should read console from pubsub live and s3 when finished` |
| AC-5 | Integration | `should show audit unavailable when PLAT-AUDIT-1 unreachable` |
| AC-6 | Unit | `should link brief decision to decision log record` |
| AC-7 | Integration | `should write captures manifest for ui task during assess` |

## Dependencies

- **blocked_by:** [TASK-010] (`log_location_ref` column)
- **unlocks:** [] (TASK-020 Decision Log consumes the same audit proxy pattern — soft link)
- **External prerequisites:** M1 storage module (S3), SSE pub/sub channel, PLAT-AUDIT-1 read,
  QA Playwright lane (all live). The captures **producer does not exist upstream** — it is
  in-scope here (AC-7); do not assume an M1/M2 capture step

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~24k input, ~12k output (capture producer adds an orchestrator-lane
  change on top of sink + panel)
- **Estimated cost:** ~$0.90 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best-practices ≥ 90 on the task route
- [ ] `ui_verify` passes; design tokens only
- [ ] `audit unavailable` greppable (invariants.md verify-by)
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings/JSDoc on public APIs/components
- [ ] Conventional commit(s); PR references this task and EPIC-005

## Implementation Hints

- Wire the sink beside the existing Audit + Billing Emitter call sites in the PDAC loop — the
  events worth logging are exactly the state changes already being emitted; do not invent a
  second event taxonomy, reuse those payloads.
- Captures grid: lazy-load images (below-fold budget, v1-delta §6); the 8 state names are a
  fixed list — render placeholders for states the manifest lacks, labelled per state.
- Capture producer: drive states with Playwright's own primitives (`hover()`, `focus()`,
  route-interception for loading/empty/error, `disabled` via selector) — no new dependency;
  "primary UI surface" = the route/component named in the task brief's `ui_verify` target.
- The Console live-tail is the same SSE mechanism Request Studio streams with (M1) — one
  shared hook, not a new client.
- Audit tab pagination follows TASK-020's Decision Log pattern; if TASK-020 lands first,
  share the audit-proxy client module.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
