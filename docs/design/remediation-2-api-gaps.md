---
type: Design
title: "UI refit — remediation step 2: active task list + API gaps"
description: "Checkboxed rollout task list (visual regression, gap closure, post-refit burn-down)
  plus the endpoint-level API gaps (G1-G14, G17) behind the signed-off refit mock."
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
- [x] **T1b · Dark-mode test coverage is fake** — the vitest browser-mode story runs and the
  visual suites don't flip `prefers-color-scheme`, so every "Dark" story variant currently runs in
  light mode (duplicate coverage, zero dark assertions). Fix: emulate `colorScheme: 'dark'` per
  Dark variant in the story test config + a dark projection in the visual-regression configs.
  (Found during the a11y-contrast fix lane, 2026-07-18.) Fixed 2026-07-18: `storybook.spec.ts`
  emulates `colorScheme` per story keyed off the `-dark` id suffix, plus an acceptance test
  asserting the `--color-bg` token actually differs between a Dark/Light story pair;
  `playwright.visual.config.ts` gained a `chromium-dark` project. See
  `packages/frontend/tests/visual/README.md` for the dark-coverage notes and two other findings
  made along the way (a stale/rebuilt `storybook-static/` catalogue surfacing 34 unbaselined
  portal-based dialog stories, and a pre-existing practice-mode-banner timing race).
- [ ] **T2 · Close the API gaps** — G1–G14 below, as small TDD backend tasks (sonnet lanes),
  sequenced so each UI lane's data is live before its pages land (see lane table in session notes:
  R2a needs G1–G3; R2b needs G4–G8+G14; R2c needs G9–G12; R2d needs G13).
- [ ] **T3 · Post-refit fix list** — after the refit lands, convert the remaining findings into a
  task list and burn down: unchecked items in `BLOAT_REPORT.md` (dead organisms, EmptyState/
  DataTable/filter-bar consolidation, proxy-helper collapse, SPARQL-escape centralisation, CI
  stack-up composite action), plus any items from the final mock review not absorbed into R2 lanes.
- [ ] **T4 · Tooltip integration pass** — the per-section pages (types, glossary, rules, audit,
  instances, query, versions, brand, build, settings) each carry their own `data-qt` concept terms
  in `refit-mock.html`'s `TIPS` map (`kinds`, `instances`, `query`, `versions`, `glossary`,
  `brandrules`, `standards`, `rules`, `policies`, `audit`, `chainlogs`, `compliance`, `projects`,
  `gates`, `studio`, `gantt`, `decisionlog`, `health`, `modeltiers`), but those pages live on
  sibling refit branches not yet merged onto one branch. Only the shell/Home/operator surfaces
  have their `InfoTip`s wired today (`operator` on the Companies header). Apply the rest of the
  `TIPS` map, page by page via `PageHeader`'s `titleTrailing` slot, once all the per-section refit
  branches land on a shared branch -- one pass, not scattered across each page's own PR, so the
  `TIPS` copy stays a single source instead of drifting per-branch.

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
- [x] **G5 L · Audit card A (model edits by kind)** — `operations.applied` payload carries no entity
  kind and no per-op breakdown; unbuildable even client-side. → emit per-kind counts in the
  operations pipeline's audit payload.
- [x] **G6 M · Audit card F (budget sub-events)** — compliance aggregates first-segment categories
  only; `cap.changed` vs `budget.breach` indistinguishable server-side. → sub-event aggregation
  (generalises to D/E/I too; one `group by event_type` with prefix filter closes G4/G6/G8 family).
- [x] **G7 M · Audit card G (top targets)** — compliance groups by actor only. → add top-target
  aggregation.
- [x] **G8 S · Audit card I (audit_outage)** — emitted but not aggregated. → include in compliance
  response.
- [x] **G9 M · Epic grouping/counts** — board + state spine are task-level only; no epic entity in
  the API. → expose epic rollups (count, per-epic task status).
- [x] **G10 L · Roadmap/gantt data** — no epic date-ranges/ordering endpoint. → smallest viable:
  epic list with status + ordinal + started/completed timestamps (gantt draws from that).
- [x] **G11 M · Spec artifact links** — only per-task briefs retrievable; no PRD/roadmap/tech-spec
  retrieval or link metadata. → spec-artifact index endpoint (id, type, status, approved_at, link).
- [x] **G12 M · Pending-gates list** — no endpoint listing tasks awaiting a HITL gate; UI must know
  task_id and stitch 4 evidence routes. → `GET /api/projects/{iri}/gates?status=pending` returning
  gate + evidence bundle refs.

- [x] **G13 S · Allowed-models endpoint** — Settings > Models & AI picker needs the validated
  model allow-list + current tier routing; backend holds `ALLOWED_MODELS` + routing config
  internally but exposes no read/write endpoint for it. → `GET/PUT /api/settings/models`
  (admin-gated, values validated against the allow-list).

- [x] **G14 S · Brand-conformance rollup** — the "brand conformance, last 30 days" KPI. Source is
  NOT OTel: every generated artefact already passes a brand gate that emits `gate_result_brand`
  audit events (backend emits these today). Conformance = pass rate over those events in the
  window; critical-rule failures tracked separately. → aggregation endpoint (or fold into the G6
  count-by-event-type work) returning `{window, passed, failed, critical_failures}`.

- [ ] **G15 M · Operator console has no backend** — `app/operator/operator-console.tsx` runs
  entirely against a hard-coded stub tenant list (`lib/operator/tenants.ts`); there is no
  platform-level list/provision/suspend endpoint for super admins to manage tenants against.
  → cross-tenant `CE-OPERATOR-1`-style endpoints: `GET /api/operator/tenants` (list + KPI
  summary), `POST /api/operator/tenants` (provision), `POST /api/operator/tenants/{id}/suspend`,
  gated to the platform-operator role (`isPlatformOperator`, not per-tenant admin).

Cards D/E are shippable now against category buckets (approximate); exact splits arrive with G6.

- [ ] **G17 S · Change heatmap overlay (per-entity change frequency)** — Explorer's Overlays tab
  wants a "Change heatmap" toggle colouring nodes by recent edit frequency. No source exists:
  `CE-METRICS-1` is aggregate-only (no per-entity breakdown) and the audit log's `target_iri`
  linkage needed to derive it is tenant-admin-gated (not viewer-facing). → either extend
  `CE-METRICS-1` with a per-entity change-count facet, or add a viewer-safe read over
  `target_iri`-grouped audit counts. Shipped today as a permanently disabled toggle with this gap
  cited in its tooltip (`use-canvas-overlay-toggles.ts`) rather than faked data.
  *(numbered G17, not G15/16 — those were claimed by concurrent backend lanes in flight at the
  time this gap was logged; renumber down if this doc is consolidated after those land.)*
