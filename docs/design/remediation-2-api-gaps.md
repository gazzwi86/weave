---
type: Design
title: "UI refit — remediation step 2: active task list + API gaps"
description: "Checkboxed rollout task list (visual regression, gap closure, post-refit burn-down)
  plus the endpoint-level API gaps (G1-G14) behind the signed-off refit mock."
tags: [design, refit, api-gaps, tasks]
status: "Active — worked under the 2026-07-18 rollout goal"
timestamp: 2026-07-17T00:00:00Z
resource: docs/design/remediation-2-api-gaps.md
source: scout fleet endpoint audit + MCQ round 2026-07-17
owner: gazzwi86
---

# Remediation step 2 — active task list + API gaps (2026-07-17)

## Active task list (post-refit programme)

- [ ] **T1 · Visual regression suite** — automated screenshot tests with baseline diffing so the
  landed refit is defended: Playwright screenshot tests per shell state + per page (the states
  already exercised by the mock-verification scripts become the spec); Storybook stories covered
  via Chromatic or `@storybook/test-runner` + pixel diff; wire into CI as a required check; real
  click paths only (no evaluate shortcuts). Baselines captured from the signed-off refit.
- [ ] **T1b · Dark-mode test coverage is fake** — the vitest browser-mode story runs and the
  visual suites don't flip `prefers-color-scheme`, so every "Dark" story variant currently runs in
  light mode (duplicate coverage, zero dark assertions). Fix: emulate `colorScheme: 'dark'` per
  Dark variant in the story test config + a dark projection in the visual-regression configs.
  (Found during the a11y-contrast fix lane, 2026-07-18.)
- [ ] **T2 · Close the API gaps** — G1–G14 below, as small TDD backend tasks (sonnet lanes),
  sequenced so each UI lane's data is live before its pages land (see lane table in session notes:
  R2a needs G1–G3; R2b needs G4–G8+G14; R2c needs G9–G12; R2d needs G13).
- [ ] **T3 · Post-refit fix list** — after the refit lands, convert the remaining findings into a
  task list and burn down: unchecked items in `BLOAT_REPORT.md` (dead organisms, EmptyState/
  DataTable/filter-bar consolidation, proxy-helper collapse, SPARQL-escape centralisation, CI
  stack-up composite action), plus any items from the final mock review not absorbed into R2 lanes.

## API gaps behind the approved mock

Scope: gaps found by endpoint-level audit when checking the signed-off MCQ direction (Rules 1b/2c/3c,
audit cards A/D/E/F/G/I, split 5a) against `packages/backend`. UI work on these screens is blocked on
the matching gap unless marked client-side-workable. Ontology conformance: **all planned writes stay
inside RDF/OWL/SHACL** — shapes go to the tenant shapes graph (ADR-023/024), policies are BPMO
individuals + `governedBy` edges via SHACL-gated CE-WRITE-1. Gaps are missing plumbing, not model
breaches.

## Covered today (no backend work)

- NL→SHACL: `POST /api/ontology/authoring/nl/shapes/preview` + `/commit` (tenant-admin, re-validated).
- Violations per rule: `GET /api/validate` (`RuleCoverage.violation_count`, per-result shape_iri).
- Policy CRUD + `governedBy` attach/detach: `POST /api/operations/apply` (all 5 ops incl. edges).
- Policy listing: SPARQL proxy (CE-READ-1), typeahead for entity pickers.
- HITL approve/reject/amend: `POST /api/tasks/{id}/hitl` (self-approval 403); per-task evidence via
  task-detail + audit + console-log + captures sub-routes.
- Project stage (`GET /api/state/{project_iri}` + lifecycle_phase), task board + task-tree.

## Gaps (checkbox = closed when fixed + verified)

- [x] **G1 M · Rules list detail** — `GET /api/validate` `RuleCoverage` lacks `sh:targetClass` +
  constraint summary; SPARQL over the tenant shapes graph unproven. → extend RuleCoverage (or add a
  shapes-catalogue endpoint).
- [x] **G2 M · Shape EDIT is unsafe** — `commit_tenant_shape` is append-only; re-committing the same
  shape IRI stacks duplicate/conflicting constraint triples. → replace-by-subject semantics before
  any edit UI ships. *(bug-class, not just gap)*
- [x] **G3 M · Shape DELETE/retire missing** — no retract path anywhere. → add retire endpoint
  (retraction from shapes graph + audit event).
- [x] **G4 S · `event_type` prefix filter not implemented** — contract promises `event_type=ce.*`;
  `audit/listing.py:63` does exact match only. → implement prefix match. *(contract violation)*
  Closed: `event_type=prefix.*` now LIKE-prefix-matches in `audit/listing.py`.
- [x] **G5 L · Audit card A (model edits by kind)** — `operations.applied` payload carries no entity
  kind and no per-op breakdown; unbuildable even client-side. → emit per-kind counts in the
  operations pipeline's audit payload.
  Closed (emit-side only): `operations.applied` now carries `kind_counts` (`operations/pipeline.py`).
  No consuming UI/dashboard card built in this lane.
- [x] **G6 M · Audit card F (budget sub-events)** — compliance aggregates first-segment categories
  only; `cap.changed` vs `budget.breach` indistinguishable server-side. → sub-event aggregation
  (generalises to D/E/I too; one `group by event_type` with prefix filter closes G4/G6/G8 family).
  Closed: `GET /api/audit/counts` groups by full `event_type` (`audit/listing.py`, `routers/audit.py`).
- [x] **G7 M · Audit card G (top targets)** — compliance groups by actor only. → add top-target
  aggregation.
  Closed: `GET /api/audit/compliance` now returns `top_targets` (`audit/compliance.py`).
- [x] **G8 S · Audit card I (audit_outage)** — emitted but not aggregated. → include in compliance
  response.
  Closed: `GET /api/audit/compliance` now returns `audit_outages` (`audit/compliance.py`).
- [x] **G9 M · Epic grouping/counts** — board + state spine are task-level only; no epic entity in
  the API. → expose epic rollups (count, per-epic task status).
  Closed: `GET /api/projects/{project_iri}/epics` (`routers/epics.py`) groups state-spine tasks by
  an optional brief-supplied `epic_id`/`epic_title` (`briefs/store.py`'s `epic_refs`, threaded
  through `POST /api/projects/{project_iri}/briefs`'s create request). No epic entity exists in the
  DB — everything ungrouped lands in a flagged `"unassigned"` bucket rather than being dropped.
- [x] **G10 L · Roadmap/gantt data** — no epic date-ranges/ordering endpoint. → smallest viable:
  epic list with status + ordinal + started/completed timestamps (gantt draws from that).
  Closed (derived, not stored): same `GET /api/projects/{project_iri}/epics` response carries
  `ordinal` + a `done`/`active`/`upcoming` `status` derived from `build.board.lane_for_status`, so
  it can never drift from the board. **Deferred:** no task-transition timestamps exist in M1, so
  `started_at`/`completed_at` are not returned — a gantt view built on this endpoint only gets
  ordinal sequencing, not date ranges, until timestamp capture lands.
- [x] **G11 M · Spec artifact links** — only per-task briefs retrievable; no PRD/roadmap/tech-spec
  retrieval or link metadata. → spec-artifact index endpoint (id, type, status, approved_at, link).
  Closed (task-brief half only): `GET /api/projects/{project_iri}/spec-artifacts`
  (`routers/spec_artifacts.py`) returns one `type: "task-brief"` entry per stored brief, `status`
  derived from the matching state-spine task (`Done` → `approved`, `Blocked` → `pending_review`,
  anything else/no task → `drafted`), `ref` pointing at the existing
  `GET /api/projects/{iri}/briefs/{task_id}` route. **Deferred:** PRD/roadmap/tech-spec are
  doc-served sections under `docs/specs/weave/engines/<entity>.md` (per `CLAUDE.md`'s spec artifact
  table), not persisted rows — no API-served entry for them yet; `approved_at` also stays unset
  (same "no task-transition timestamp in M1" deferral as G10).
- [x] **G12 M · Pending-gates list** — no endpoint listing tasks awaiting a HITL gate; UI must know
  task_id and stitch 4 evidence routes. → `GET /api/projects/{iri}/gates?status=pending` returning
  gate + evidence bundle refs.
  Closed: `GET /api/projects/{project_iri}/gates?status=pending` (`routers/gates.py`) lists every
  state-spine task with `status == "Blocked"` (the same HITL-escalation signal
  `build.board.lane_for_status`/`hitl_escalated` already read) with a bundled `evidence` object
  (`task_detail`, `audit`, `console_log`, `captures`, `hitl_action` refs) so the UI no longer
  stitches 4+1 routes by hand from a bare `task_id`. **Deferred:** no per-task gate-type (DoR vs DoD
  vs pre-scaffold) is captured in the state spine, so every entry's `gate` field is the generic
  `"hitl"` literal, not the specific gate that fired.

- [ ] **G13 S · Allowed-models endpoint** — Settings > Models & AI picker needs the validated
  model allow-list + current tier routing; backend holds `ALLOWED_MODELS` + routing config
  internally but exposes no read/write endpoint for it. → `GET/PUT /api/settings/models`
  (admin-gated, values validated against the allow-list).

- [ ] **G14 S · Brand-conformance rollup** — the "brand conformance, last 30 days" KPI. Source is
  NOT OTel: every generated artefact already passes a brand gate that emits `gate_result_brand`
  audit events (backend emits these today). Conformance = pass rate over those events in the
  window; critical-rule failures tracked separately. → aggregation endpoint (or fold into the G6
  count-by-event-type work) returning `{window, passed, failed, critical_failures}`.

Cards D/E are shippable now against category buckets (approximate); exact splits arrive with G6.
