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

- [x] **T1 · Visual regression suite** — automated screenshot tests with baseline diffing so the
  landed refit is defended: Playwright screenshot tests per shell state + per page (the states
  already exercised by the mock-verification scripts become the spec); Storybook stories covered
  via Chromatic or `@storybook/test-runner` + pixel diff; wire into CI as a required check; real
  click paths only (no evaluate shortcuts). Baselines captured from the signed-off refit.
  **Wired into CI 2026-07-19** (`.github/workflows/ci.yml` `visual` job): storybook-visual +
  shell-visual run on every PR; baselines regenerated on the amd64 runner via the
  `workflow_dispatch` `update_visual_baselines` input (arm64-Mac `:update` would drift at the
  0.001 tolerance — README §Testing documents the flow). Behavioural-certification e2e +
  the codified API-log 5xx sweep landed alongside as the `e2e-behavioural` job. Honest ceiling:
  "required check" == the job runs on `pull_request` and its failure reddens the run; this repo
  has no server-side required-check flag (git-safety.md).
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

- [ ] **G19 UI-bug · Canvas node-click misses under overlay chrome** — the new ControlDock/legend/
  overlay chrome likely needs pointer-events/z-order fixed so clicks pass through to cytoscape nodes
  underneath (the explorer-a11y-m2 spec had to route around a flaky canvas click). Real fix = component
  pointer-events; the test currently opens panels via the search box instead. (Escalation TASK-030.)

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

## T4-derived follow-ups (2026-07-18 coverage-reconciliation MCQ — user decisions)

- [ ] **T5 L · Consolidate Home → Dashboard (canonical, post-login landing)** — user decision: the
  canonical Home is **`/dashboard`**, and it is the page users land on immediately after login.
  `/role-home` is demoted. But role-home carries UNIQUE surface dashboard lacks — the **next-action
  banner** (`data-tour-id="plat.role-home.next-action"`), **capability cards** (role-scoped), and
  the **completeness map** — plus the guided-tour anchor. So routing and migration are one unit:
  migrate those three surfaces (and re-anchor the tour) INTO dashboard, set dashboard as the login
  landing, THEN delist role-home. Do NOT delist role-home before the migration (it would drop the
  guided onboarding for the defer window). Dashboard already has ChecklistWidget + GetGoing, so the
  onboarding checklist half is already present. Feature-sized; own PR, off the T4 remediation path.

- [ ] **T6 L · `/build/ge-canvas-preview` → project-scoped filtered Explore** — user decision: this
  is a KEPT, intended surface, not a dev artifact. Rebuild it to be **functional like `/explorer`
  but filtered to a single project** — showing only the entities/processes/data created, affected,
  or relevant to that project (a focused, filtered project-level graph view). Link it from the
  **build-project nav** (per project, not top-level). Aim: users build out and augment processes as
  they build an app / feature / data pipeline. Optionally model a project-level ontology linked to
  the parent graph. Feature-sized; own PR, off the T4 remediation path. Related canvas bug: G19.

- [ ] **T7 S · `/events` → disabled "coming soon" nav item** — Events & Actions engine ships
  post-MVP (build order) and the mock has no Events screen. Per the no-phase-pills rule
  (`feedback_no_phase_pills`): keep it in the nav but disabled with a "soon" affordance, not a live
  bare stub. Small; can land with the T4 remediation follow-up.

- [ ] **T8 M · Onboarding exercise-availability (kill the 403 noise)** — the checklist widget POSTs
  `/api/onboarding/exercises/{id}/check` for exercises the backend gates off (403: `read_only_locked`
  for CE-02, `path_gated` for CE-03 — the client's checklist-item paths and the backend exercise
  paths disagree, and the client doesn't know `path_variant`). User decision: **fix properly** —
  backend exposes per-exercise availability (e.g. on `GET /api/onboarding/state`, an
  `available_exercises` set computed via `gate_exercise`) so the client only checks available ones,
  with no gate-logic duplication client-side. Fail-soft today (caught, no loop), so log-noise-only.

## T4 visual-remediation directives (2026-07-18, user MCQ answers + follow-up asks)

Process mandate (applies to ALL items below): make every visual change via **Storybook + atomic
design** (dumb components in the library; pages stay data-binding-only), and **update the affected
tests** in turn. No bespoke CSS in pages.

- [x] **V1 · Section-header eyebrow styling (do-now, no decision)** — mock uses small muted UPPERCASE
  letter-spaced eyebrow labels; app uses large title-case. Cross-cutting; lifts Home/Audit/Build/
  Settings/Operator. One shared atom/molecule fix.
- [x] **V1b · Apply Eyebrow to Audit/Build/Settings headers** — the Eyebrow primitive (components/ui/
  eyebrow.tsx) + PageHeader eyebrow slot + Home application landed in V1 core (PR #151); apply the muted
  Eyebrow to Audit/Build/Settings section+card headers next (first lane hit the tool-use cap). Reuses the primitive.

- [x] **V2 · Constitution `/ce` = polished overview landing** — user: /ce should land on a polished
  OVERVIEW page similar to the mock (NOT explore-first, NOT the current bare panel + raw file input).
  Add logical widgets. Explore stays at /explorer.
- [ ] **V3 · Explore graph legibility** — user: show ALL nodes but with strong default filters +
  clustering + label-thinning so it's legible at scale (not a curated 8-node seed). Also: human-
  readable labels (not machine IDs), restore the "Ask the model" bar, populate the KPI strip.
  Remove the injected "Graph Explorer" H1.
- [ ] **V3-axe-fix · Explorer a11y panels violation (blocks #152)** — explorer-a11y-m2 "Explorer M2 panels zero-violations" test fails on V3 core (#152). Repro locally (serve V3 app, run the spec) to get the exact axe rule+node, fix, re-push #152. Keep the sr-only h1.

- [ ] **V3b-3 · Explore default-filter + KPI true-total** — V3b-2 item1 (label-thinning) landed; add a sensible DEFAULT view/filter (show-all one click away) AND fix the KPI strip to show the TRUE model total, not the filtered render count (V3b-1 sourced it from rendered elements — wrong once filtering exists). Coupled; land together. Stretch: clustering.

- [x] **FLAKY-axe-m2 · Stabilise explorer-a11y-m2 panels test** — **FIXED #167 (2026-07-19)**: per-tab `data-testid` `control-dock-panel-<id>` awaited before each axe scan (generic "panel open" wait insta-passed on tabs 2–4 before React committed the new panel). Residual base-sensitivity (stale-base false reds) remains — rerun+rebase-check on a red run. Original: the `explorer-a11y-m2` "Explorer M2 panels zero-violations" test is flaky (false-failed on #149, #152, #158; #152 also base-sensitive). Cost real debugging effort mis-read as real regressions. Investigate timing (ControlDock accordion mount + axe race) and stabilise (await panel-ready before axe, or retry). Until then: an axe-m2 fail on an explorer-adjacent PR = rerun + rebase-check before assuming real. **Fix in flight 2026-07-19** (`feature/axe-m2-deflake`, user chose the real root-cause fix over a CI-retry stopgap): await the ControlDock accordion mount before each axe scan.

- [ ] **V3b · Explore ask-bar + KPI + de-hairball** — V3 core (PR #152) landed H1 removal + human labels.
  Remaining: wire the existing `components/molecules/AskBar.tsx` onto the canvas bottom-centre (partial unwired
  scaffold lib/explorer/fetch-ask-answer.ts exists in the v3 worktree); populate the KPI strip from loaded graph
  data; de-hairball via strong default filters/clustering/label-thinning (the hard part). Scope as SMALL lanes.

- [ ] **V4 · Off-spec elements** — user: REMOVE injected page H1s to match mock. KEEP value-adding
  functionality (e.g. Build search/filter) but RESTYLE to the mock's look/feel. KEEP the "Generate a
  widget" CTA (intentional) but update it to match the mock's approaches/trends.
- [x] **V5 · Profile menu → Operator (super-admin) console link** — avatar-menu.tsx lacks the mock's
  role-gated "Operator console — provision companies" entry (super-admins only). Add it.
- [x] **V6 · Super-admin company switcher (BUILT, merged #158) (was NUANCE — confirm before building)** — the mock's switcher
  is explicitly "company switcher — SUPER ADMIN ONLY (members never see this; workspace ≡ company)".
  A prior binding ruling (header-scope.ts cites v1-design-requirements.md R7) RETIRED the *general*
  header workspace switcher for all roles; provisioning lives in Settings->Workspaces. So the mock's
  switcher is a SUPER-ADMIN company switcher (adjacent to the Operator console / V5), NOT a general
  one. CONFIRM with user: build the super-admin company switcher per mock, vs the existing
  Settings->Workspaces + operator console already cover it. Do NOT resurrect the general switcher
  against the ruling. The avatar "Switch workspace" item stays regardless.
- [x] **V7 · Card/panel styling (INVESTIGATED — no fix: cards already match mock; 'flatness' = empty placeholder data + faint by-design border, routed to data backlog) + empty states** — audit/build cards render flat/borderless + empty
  "Not available yet"; mock has bordered panels with populated data. Styling now (bordered panels,
  gradient bars); DATA population (G12, CE-METRICS, registry summary field) deferred per user.

## 2026-07-19 full-app review findings (folded from review-findings-2026-07-19.md, user-approved)

Source: click-through review of main @ 20bad2b1 (`docs/design/review-findings-2026-07-19.md` — kept
as the detail record; work state lives HERE). Severity: **H** = breaks use/looks broken, **M** =
clearly off, **L** = polish. Priority order per goal: S1, D1, A1, H1/H2/H3, C1, S6, then remainder
by severity.

### Shell (cross-cutting)

- [ ] **S1 H · Horizontal overflow hides header right cluster** — with the secondary sidebar open,
  page is wider than viewport at 1568px: bell / help "?" / avatar sit ~100–200px off-screen (plus
  their flyouts anchor off-viewport). Pages without the secondary sidebar (404) fit. Likely a
  fixed-width sum (rail + sidebar + min-width content) exceeding `100vw`. Fix at the shell layout
  source, not per-page.
- [ ] **S2 M · Stale breadcrumbs** — CE subpages all show "Constitution / Overview"; Audit stays
  "Audit trail / Dashboard"; Build stays "Build / Registry". Settings/Billing updates correctly —
  pattern exists, other sections don't feed it.
- [ ] **S3 L · First-click dead-nav on icon rail — likely test-tool artifact** — reproduced on the
  static mock too (plain inline onclick) → suspect synthetic click. Verify with a human hand once;
  drop if unreproducible.
- [ ] **S4 M · Bottom-left rail "?" does nothing** — header "?" opens the good Help panel; rail "?"
  is dead. Two help affordances, one dead.
- [ ] **S5 M · ⌘K palette: input not focused on open; typing goes nowhere** — also "No results."
  before any query; entity-search only while placeholder promises "Search, ask, or jump to…".
- [ ] **S6 H · Global search returns nothing for known entities** — `GET /api/search?q=order` → 200
  empty while model contains "Customer order placed", "Order Fulfillment", glossary "Order".
  Suspect workspace scoping or index not covering the demo workspace.
- [ ] **S7 L · Avatar initials render "SI" for user `admin`** — initials derivation wrong (from
  "Signed in"?).

### Home / dashboard

- [ ] **H1 H · Widget tiles broken** — header controls render as raw inline text
  "↑↓ Pin Unpin Publish" (both Pin *and* Unpin always visible); titles wrap badly
  ("Entities in / model").
- [ ] **H2 H · "Latest published version" shows full URN** as display text — should be "v0.1.6" +
  workspace label.
- [ ] **H3 M · Stale-badge pill wraps over three lines** ("Stale — last updated / date / time").
- [ ] **H4 M · "Needs you" rows carry internal gap copy** — "pending, no cross-workspace gate feed
  yet (gap G12)". G12's endpoint landed; wire the feed, kill the placeholder copy.
- [ ] **H6 M · /notifications renders the bell-panel popover floating on an empty page** — should
  be a full-width notifications list page (mock carries the reference design).
- [ ] **H7 L · "What can Weave do for you?" sidebar item re-shows the dashboard** (role-home folded
  in per T5) — drop or rename.
- [ ] **H8 L · `/api/onboarding/state` fetched 4× per dashboard load** — dedupe.

### Constitution

- [ ] **C1 H · Overview "Published version: No data yet" while Explore KPI + dashboard show
  v0.1.6** — Overview reads a different (wrong) source.
- [ ] **C2 L · Overview copy points to "the Versions screen" while nav "Versions" is soon** —
  copy/nav mismatch.
- [ ] **C3 M · Types page "Instances" column all "—"** (counts not wired).
- [ ] **C4 M · Instances/Data: Ask panel overlaps the table** (Status column truncated).
- [ ] **C5 H · Explore label soup** — raw RDF IRIs (`…rdf-syntax-ns#type`) as labels; orphaned
  description sentences as node labels; drawer edge list shows raw IRIs instead of resolved
  labels. (Overlaps V3b work.)
- [ ] **C6 M · Rules & policies carries an "M1 — this pass" phase pill** (violates no-phase-pills
  rule) and page is nearly bare — no rules list or designed empty state.
- [ ] **C7 M · Glossary Definition/Related columns all "—"** — demo seed has no definitions (D2).
- [ ] **C8 M · Branding & standards effectively empty** — conformance "—" with "(G14)" dev copy;
  no seeded standards/brand rules (Hammerbarn content brief should drive the seed — D2).
- [ ] **C9 L · "New instance" = bare "Choose a kind…" select on an empty page** vs the mock's
  authoring pattern.

### Audit trail

- [ ] **A1 H · "Chain broken at entry 2 · 0 entries checked" on the demo workspace** — seeded
  audit chain fails verification; every demo shows a red integrity banner. ~~Seed bug.~~
  **ROOT CAUSE (coordinator-verified against the live dev DB 2026-07-19): NOT a seed bug — a
  multi-tenant verify bug.** The chain is per-tenant (emitter scopes seq/prev_hash by tenant_id;
  each tenant's chain is intact, seq restarts at 1 per tenant) but the verify path fetches entries
  ordered by seq with NO tenant filter, so any DB with ≥2 tenants interleaves chains and "breaks
  at entry 2". Fix: tenant-scope the verify fetch/walk. Secondary: `entries_checked` stays 0 on
  failure (dataclass default never updated before the early return). Repro needs TWO tenants
  emitting — a single-tenant repro passes verify.
- [ ] **A2 M · Busiest-entities list shows raw UUIDs/version strings**, not entity labels.
- [ ] **A3 M · Dashboard cards not wired to closed gaps** — "Model edits by kind" +
  Security/Governance/Budget/Reliability all "Not available yet" though G5–G8 aggregations landed.
- [ ] **A4 · Inference nav is "soon"** (Sentiment, Intent & urgency, Topics, Satisfaction,
  Quality & safety, Model metrics) — now represented in the mock as future-phase reference
  screens; no app work until those phases.

### Build

- [ ] **B1 L · Registry card dev copy** — "task counts and budget need a registry-card summary
  field".
- [ ] **B2 M · Dashboard Roadmap panel dev copy** — "needs an epics endpoint" though G9/G10
  landed; wire it.
- [ ] **B3 M · Kanban default state reads as a filter failure** ("No tasks match this filter" +
  bare "Task tree" card) instead of a designed empty board.
- [ ] **B4 L · Decision log: default tab shows "No decisions match this search" before any
  search; stray "Back to settings" link.**
- [ ] **B5 L · Project settings "Review upgrade" is a giant full-width button** — off-design.

### Settings

- [ ] **SE1 L · General: Description placeholder is dev copy** ("the backend doesn't store a
  workspace description").
- [ ] **SE2 M · Members: every role select shows "Viewer" — including the seeded super-admin.**
  Role mapping/display bug.
- [ ] **SE3 L · Models & AI shows "(gap G13)" dev copy.**
- [ ] **SE4 M · Billing page is a single sparse card** — mock carries the reference design (usage
  by engine/user/project, budget burn vs cap, counts-only note per FR-034/035).
- [ ] **SE5 M · Operator console (Workspaces) is bare** — plain cards + form vs the signed-off
  operator screen in the mock.
- [ ] **SE6 M · "Profile & preferences" in the user menu lands on workspace General** — no
  user-profile surface exists (mock carries one).

### Cross-cutting content

- [ ] **D1 M · Internal tracker language leaks into product UI in ≥6 places** — "(gap G12)",
  "(G13)", "(G14)", "backend aggregation pending", "needs an epics endpoint", "registry-card
  summary field", "backend doesn't store…". ONE sweep replacing all with human empty-state copy
  (mock's error/empty patterns are the reference). Absorbs the copy half of H4/B1/B2/SE1/SE3/C8.
- [ ] **D2 M · Demo seed gaps undercut the demo** — no glossary definitions, no brand
  standards/rules, no build tasks/epics on the demo project, broken audit chain (A1), roles all
  Viewer (SE2). Hammerbarn content brief (`docs/specs/weave/hammerbarn-content-brief.md`) should
  drive a fuller seed. Absorbs the data half of C7/C8.
