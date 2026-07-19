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

- [x] **G19 UI-bug · Canvas clicks under overlay chrome** — **FIXED #192**: ControlDock +
  CanvasAskBar wrappers are pointer-events-none; only opaque chrome opts back in. (The a11y
  spec's search-box route-around can now be reverted — noted in ISSUES follow-ups.)
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

- [x] **T7 S · /events soon-state** — verified already correct (disabled rail entry +
  PlaceholderPage); the stale piece was ia-skeleton.spec.ts asserting the old behaviour —
  **FIXED #192**.
- [x] **T8 M · Onboarding exercise availability** — **FIXED #193**: GET /api/onboarding/state
  returns `available_exercises` (computed by the same gate_exercise authority); the checklist
  intersects before queuing checks. 403 noise gone, no client-side gate duplication.

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
- [x] **V3-axe-fix** — STALE, closed 2026-07-19: PR #152 merged long ago; the axe race was
  fixed for real in #167 (FLAKY-axe-m2).
- [ ] **V3b-3 · Explore default-filter + KPI true-total** — V3b-2 item1 (label-thinning) landed; add a sensible DEFAULT view/filter (show-all one click away) AND fix the KPI strip to show the TRUE model total, not the filtered render count (V3b-1 sourced it from rendered elements — wrong once filtering exists). Coupled; land together. Stretch: clustering.

- [x] **FLAKY-axe-m2 · Stabilise explorer-a11y-m2 panels test** — **FIXED #167 (2026-07-19)**: per-tab `data-testid` `control-dock-panel-<id>` awaited before each axe scan (generic "panel open" wait insta-passed on tabs 2–4 before React committed the new panel). Residual base-sensitivity (stale-base false reds) remains — rerun+rebase-check on a red run. Original: the `explorer-a11y-m2` "Explorer M2 panels zero-violations" test is flaky (false-failed on #149, #152, #158; #152 also base-sensitive). Cost real debugging effort mis-read as real regressions. Investigate timing (ControlDock accordion mount + axe race) and stabilise (await panel-ready before axe, or retry). Until then: an axe-m2 fail on an explorer-adjacent PR = rerun + rebase-check before assuming real. **Fix in flight 2026-07-19** (`feature/axe-m2-deflake`, user chose the real root-cause fix over a CI-retry stopgap): await the ControlDock accordion mount before each axe scan.

- [ ] **V3b · Explore ask-bar + KPI + de-hairball** — V3 core (PR #152) landed H1 removal + human labels.
  Remaining: wire the existing `components/molecules/AskBar.tsx` onto the canvas bottom-centre (partial unwired
  scaffold lib/explorer/fetch-ask-answer.ts exists in the v3 worktree); populate the KPI strip from loaded graph
  data; de-hairball via strong default filters/clustering/label-thinning (the hard part). Scope as SMALL lanes.

- [x] **V4 · Off-spec elements** — verified DONE 2026-07-19 (#192 evidence): both mocks keep a
  visible h1.page-title on every screen except the Explore canvas (removed in #152); F-D07
  mandates the visible h1 size. Search/filter bar + "Generate a widget" CTA audited: fully
  token-styled. No changes needed.
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

- [x] **S1 H · Horizontal overflow hides header right cluster** — **FIXED #171 (2026-07-19)**.
  Root cause: AppHeader's centre wrapper lacked `min-w-0`, so the command bar held intrinsic width
  and pushed the fixed 320px right zone off-viewport once rail+sidebar narrowed the column (mock
  shrinks the cmdbar via `min-width:0`+`max-width:100%`; app dropped it). Fix: `min-w-0` on the
  wrapper + `truncate` on the label. New e2e (real login clicks, 1280×900) asserts bell+avatar
  on-viewport; shell visual baselines regenerated on the amd64 runner.
- [x] **S2 M · Stale breadcrumbs** — **FIXED #183**: resolution used first-match over nav items;
  now longest-href (most specific) match. Also silently fixed /settings/members + onboarding-path.
- [ ] **S3 L · First-click dead-nav on icon rail — likely test-tool artifact** — reproduced on the
  static mock too (plain inline onclick) → suspect synthetic click. Verify with a human hand once;
  drop if unreproducible.
- [x] **S4 M · Bottom-left rail "?" does nothing** — **FIXED #183**: it was a decorative
  aria-hidden user-initial badge with no handler; now a real Help trigger opening the same panel.
- [x] **S5 M · ⌘K palette** — **FIXED #183** (partly): idle state before typing added; header
  trigger copy reworded to honest "Search entities" until ask/jump ship (deliberate temporary
  divergence from the mock's aspirational copy). Focus-on-open did NOT reproduce in real Chromium —
  likely S6's dead search read as "typing goes nowhere". Ask/jump remain future work.
- [x] **S6 H · Global search returns nothing for known entities** — **FIXED #175 (2026-07-19)**.
  Root cause: search SPARQL matched only `rdfs:label`, but the store holds zero such triples —
  entities carry `weave:label` (every AddNodeOp) and glossary concepts `skos:prefLabel`. The
  tenancy test hand-loaded `rdfs:label` triples, masking it. Fix: property-path alternation over
  all three predicates; test now seeds via the real apply_operations path + skos-only case; all
  tenancy assertions preserved. Verified via real API on an isolated stack. Known pre-existing
  edge (logged, unfixed): `OPTIONAL {?iri a ?kind}` fans out one row per rdf:type.
- [x] **S7 L · Avatar initials "SI"** — **FIXED #186**: AppShell defaulted a missing session name
  to "Signed in" before the initials deriver. Nullable name now passes through; "?" fallback.

### Home / dashboard

- [x] **H1 H · Widget tiles broken** — **FIXED #178 (2026-07-19)**: token-styled icon/text tile
  controls (AppHeader icon-button pattern), exactly one of Pin/Unpin per pinned state, titles
  truncate. Pin/Unpin stay text buttons deliberately — no pin glyph in the mock's icon sprite.
- [x] **H2 H · "Latest published version" shows full URN** — **FIXED #178**: `formatKpiValue`
  shortens `urn:…:vX.Y.Z` to the version tag, full URN in `title`. Display-layer only.
- [x] **H3 M · Stale-badge pill wraps** — **FIXED #178**: single-word "Stale" nowrap badge,
  timestamp in a deterministic tooltip (also removes an SSR/hydration-divergent toLocaleString).
- [x] **H4 M · "Needs you" gates feed** — copy fixed in #176 (D1); feed **WIRED #185**:
  review-gates row aggregates G12 pending gates across the workspace's projects. Decisions row
  stays static — G12 entries carry only gate:"hitl", no distinct decisions source exists yet.
- [ ] **H6 M · /notifications renders the bell-panel popover floating on an empty page** — should
  be a full-width notifications list page (mock carries the reference design).
- [ ] **H7 L · "What can Weave do for you?" nav item — FOLDED INTO T5, do not work standalone.**
  Investigation (#186 lane) showed the premise is stale: /role-home still owns three surfaces
  /dashboard lacks (next-action banner, capability cards, completeness map) and T5 forbids
  delisting before those migrate. Delist happens as part of T5's migration, not before.
- [x] **H8 L · `/api/onboarding/state` fetched 4×/load** — **FIXED #186**: four components each
  fetched on mount; all share one in-flight-cached client now (explicit refreshes still bypass).

### Constitution

- [x] **C1 H · Overview "Published version: No data yet"** — **FIXED #172 (2026-07-19)**. Root
  cause: `use-overview.ts` parsed the versions endpoint as `{versions: []}` but it returns a bare
  array; the fail-soft catch swallowed the shape error. Fix: reuse the tolerant `fetchVersions()`
  from use-versions.ts (one parser, two consumers) + hook-level regression tests for both shapes.
  Verified live: /ce shows v0.1.6, "No data yet" gone.
- [x] **C2 L · Versions copy/nav mismatch** — **FIXED #186**: /ce/versions is fully built but nav
  still flagged built:false ("soon" pill). Flag flipped; copy was already right.
- [x] **C3 M · Types instance counts** — **FIXED #190**: bound to the same CE-READ-1 rdf:type
  tally the Overview computes (one shared source).
- [x] **C4 M · Instances table/Ask overlap** — **FIXED #190**: the DataTable outgrew its 1fr
  grid track (table-layout:auto + min-width:auto) and overflow-hidden clipped Status/Updated
  beside the panel. `table-fixed` + `min-w-0`; verified by bounding-box at 768–1440px.
  DataTable-family story baselines regenerated.
- [ ] **C5 H · Explore label soup** — raw RDF IRIs (`…rdf-syntax-ns#type`) as labels; orphaned
  description sentences as node labels; drawer edge list shows raw IRIs instead of resolved
  labels. (Overlaps V3b work.)
- [x] **C6 M · Rules & policies phase pill** — **FIXED #186**: pill removed. The "nearly bare"
  half was stale — page already has full rules table + policies + drawer with standard empty states.
- [x] **C7 M · Glossary Definition/Related columns all "—"** — **FIXED via seed enrichment
  (#184)**: definitions + skos:broader related links seeded; browse query surfaces
  `?definition` (c1873669).
- [ ] **C8 M · Branding & standards** — data half SEEDED (#184: brand rules + standards docs);
  dev copy fixed (#176). REMAINING: bind the page + conformance KPI (G14 endpoint) and match
  the mock's screen → ISSUES.md §Design.
- [ ] **C9 L · "New instance" = bare "Choose a kind…" select on an empty page** vs the mock's
  authoring pattern.

### Audit trail

- [ ] **A1 H · "Chain broken at entry 2 · 0 entries checked" on the demo workspace** — root cause
  settled 2026-07-19 (evidence: `.claude/state/escalations/A1-audit-chain-seed-blocker.md`):
  **NOT a code bug.** Per-entry recomputation on the live dev DB shows hash + prev_hash linkage
  100% intact for the demo tenant; only the **signatures on seq 2–9** fail — a one-time
  signing-key divergence between processes during the 2026-07-16 dev session. Two earlier
  hypotheses (clock-tie ordering; multi-tenant interleaved verify walk) were both refuted: `ts` is
  app-assigned text, verify orders by monotonic `seq` and is tenant-scoped. Code half **landed in
  PR #177**: verify now reports `entries_checked` on failure (was always 0), plus seed→verify
  regression coverage (passes on a fresh stack). Remaining half is DATA: the SHARED stack's
  acme-corp audit_entries still carry the stale seq 2–9 signatures until operationally reseeded
  (#184 added the fresh-seed→valid-chain regression; a fresh seed verifies clean) → ISSUES.md
  §Ops. Follow-up A5 (signing-key hardening) → ISSUES.md §Bug squad.
- [ ] **A2 M · Busiest-entities list shows raw UUIDs/version strings**, not entity labels.
- [x] **A3 M · Audit dashboard cards** — **WIRED #182**: model-edits-by-kind sums G5 payloads via
  a new tenant-scoped /api/audit/counts proxy; health tiles read G6 sub-events; busiest entities
  bind G7 top_targets. Cards distinguish denied/error vs genuinely-empty vs populated.
- [ ] **A5 S · Signing-key divergence hardening (follow-up from A1)** — local dev with multiple
  processes/worktrees sharing one LocalStack can cache diverging audit signing keys and silently
  corrupt chain signatures. Consider failing loudly in `signing_key.py` when the cached key no
  longer matches the persisted secret. Flagged by the A1 lane; not built on a hunch.
- [ ] **A4 · Inference nav is "soon"** (Sentiment, Intent & urgency, Topics, Satisfaction,
  Quality & safety, Model metrics) — now represented in the mock as future-phase reference
  screens; no app work until those phases.

### Build

- [x] **B1 L · Registry card task counts** — **FIXED #193**: cards derive counts from the G9
  epics rollup (lazy per-project fetch). Budget stays "—" — no per-project budget source yet.
- [x] **B2 M · Build Roadmap panel** — copy fixed in #176; **WIRED #185**: binds the G9/G10 epic
  rollup (GET /api/projects/{id}/epics) — ordered epic list w/ status badge + done/total counts.
  No Gantt: G10's date fields still deferred, so no fabricated bars.
- [x] **B3 M · Kanban empty board** — **FIXED #188**: no-tasks-at-all state ("No tasks yet —
  they appear when a build run starts.") distinguished from filter-excluded (old copy + reset).
- [x] **B4 L · Decision log** — **FIXED #188**: idle empty state before any search; stray
  "Back to settings" link removed (mock reaches the page from left nav).
- [x] **B5 L · "Review upgrade" full-width button** — **FIXED #188**: flex-column align-stretch
  default; `w-fit`, matching GovernanceForm's identical fix.

### Settings

- [x] **SE1 L · Workspace description** — **FIXED #193**: `workspaces.description` (migration
  0086) + tenant-admin PUT route + proxy; General textarea binds and saves on blur.
- [x] **SE2 M · Members roles all "Viewer"** — **FIXED #181**: disabled select offered only the
  10 canonical slugs; seeded members carry ADR-020 legacy 4-tier slugs, and an unmatched value
  makes a native select display its first option. Select now renders the member's actual role
  (canonical → legacy map → raw slug). Backend was always correct. NOTE: legacy "admin" stays a
  super-admin sentinel — never canonicalize it (see memory reference_legacy-admin-role-sentinel).
- [x] **SE3 L · Models & AI "(gap G13)" dev copy** — **FIXED #176** (D1 sweep: "Model tiers are
  fixed for now."). Editable model routing itself is G13's endpoint work, already [x] above.
- [ ] **SE4 M · Billing page is a single sparse card** — mock carries the reference design (usage
  by engine/user/project, budget burn vs cap, counts-only note per FR-034/035).
- [ ] **SE5 M · Operator console (Workspaces) is bare** — plain cards + form vs the signed-off
  operator screen in the mock.
- [ ] **SE6 M · "Profile & preferences" in the user menu lands on workspace General** — no
  user-profile surface exists (mock carries one).

### Cross-cutting content

- [x] **D1 M · Internal tracker language leaks into product UI** — **FIXED #176 (2026-07-19)**:
  one sweep over 21 user-visible sites (gap IDs, "isn't wired yet", "M1" refs, endpoint talk)
  replaced with human empty-state copy; 10 test files updated to the new strings. Copy half of
  H4/B1/B2/SE1/SE3/C8 absorbed — their data-wiring halves stay open.
- [x] **D2 M · Demo seed gaps undercut the demo** — **FIXED via seed enrichment (#184,
  2026-07-19)**: glossary definitions, brand rules + 2 standards docs, 3 SHACL rules, a Build
  project (3 epics / 10 tasks across kanban states), roles, audit — idempotent. Roles stay
  LEGACY on purpose: "admin" is the super-admin sentinel the provisioning page +
  `require_tenant_admin` gate on literally — do NOT re-canonicalize (see
  `.claude/memory/reference_legacy-admin-role-sentinel.md`; display handled by #181).
  Residual: the SHARED stack's acme-corp audit chain still needs an operational reseed →
  ISSUES.md §Ops (A1 residual).
