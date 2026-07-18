# Bloat report — DRY / SOLID / YAGNI audit (whole system)

Generated 2026-07-17 by a scout fleet (4 parallel audits: frontend components, frontend logic,
backend + shared, repo-wide non-app surface). **Report only — fixes are tracked here and ticked
off as they land.** Severity: **blocker** (actively causing user-visible drift/bugs) · **major**
(real debt, fix soon) · **minor** (fix when touched).

Resolution direction for "parallel implementation" findings is settled by project principle
(`.claude/memory/feedback_dumb_smart_components.md`): **the atomic library is canonical — refit
the app onto it; delete the app-side bespoke copy** (unless the library version is genuinely
obsolete). Tick a box only when the fix is merged and verified.

## 1. Frontend — components & pages

Method note: importer counts are exact path-greps (no barrel files, so greps catch all imports).

- [ ] **1.1 blocker · Parallel impl** — `components/shell/app-shell.tsx:72-135`: live header
  hand-composed, does NOT use `organisms/AppHeader.tsx` (two header implementations).
  → Refit shell onto AppHeader. *(in progress on `feature/ui-refit-shell`)*
- [ ] **1.2 blocker · Parallel/dead** — `components/organisms/CommandBar.tsx`: zero live
  importers; live command UX is `shell/command-palette.tsx`. → Wire shell to the organism (or
  fold the shell implementation into it).
- [ ] **1.3 blocker · Dead (consequence of 1.1)** — `components/organisms/AppHeader.tsx`: zero
  live importers (manifest + story only). → Consumed via 1.1.
- [ ] **1.4 major · Parallel/dead** — `components/templates/CanvasPage.tsx`: zero app importers;
  live explorer renders its own legend/toolbar/panel stack. → Refit explorer onto the template
  (phase 2, Explore refit).
- [ ] **1.5 major · Parallel/dead** — `components/templates/DashboardGrid.tsx`: zero app
  importers; live dashboard is `components/dashboard/widget-grid.tsx`. → Refit dashboard onto it.
- [ ] **1.6 major · Parallel impl** — `molecules/CanvasLegend.tsx` + `molecules/CanvasToolbar.tsx`
  vs `explorer/canvas-legend.tsx` + `explorer/canvas-toolbar.tsx`: two implementations each.
  → Refit explorer onto the molecules (phase 2).
- [ ] **1.7 major · YAGNI wrapper** — `organisms/InspectorPanel.tsx`: thin wrapper over
  `explorer/side-panel.tsx`, one real caller. → Collapse during phase 2.
- [ ] **1.8 major · DRY** — EmptyState ×4: `molecules/EmptyState.tsx`, `explorer/empty-state.tsx`,
  `app/build/projects/[id]/board/empty-state.tsx`, inline in `registry-grid.tsx` +
  `ce/glossary/page.tsx`. → Consolidate on `molecules/EmptyState`.
- [ ] **1.9 major · DRY** — hand-rolled `<table>` ×7 (`audit/logs`, `role-home`,
  `settings/notifications`, `settings/contributors-tab`, `decision-log-panel`,
  `ce/query/results-table`, `dashboard/widget-tile`) while `organisms/DataTable.tsx` sits barely
  consumed. → Refit columnar tables onto DataTable.
- [ ] **1.10 major · Parallel impl** — `ui/entity-picker.tsx` vs `molecules/EntityPicker.tsx`:
  two live entity pickers. → Merge to one.
- [ ] **1.11 major · Dumb/smart** — `app/audit/logs/page.tsx` (286 lines, 22 classNames): worst
  inline-presentational route page (hand-rolled table + filter bar). → Extract to
  DataTable/PageHeader/shared filter bar (phase 3).
- [ ] **1.12 minor · DRY** — filter bars ×4: `build board/filter-bar.tsx`,
  `explorer/filter-panel.tsx`, `explorer/canvas-filter-chrome.tsx`, inline in audit/logs +
  registry-grid. → Extract ONE filter-bar molecule; reuse everywhere (user-mandated shared
  pattern).
- [ ] **1.13 minor · Budget + dumb/smart** — `app/build/.../pin-upgrade-section.tsx` (302 lines):
  over file budget, bespoke drawer markup. → Split; compose from FormDrawerPage/GlassPanel.
- [ ] **1.14 minor · Dumb/smart** — `app/ce/types/page.tsx`, `app/ce/overview/page.tsx`,
  `app/audit/page.tsx`: high inline-presentational density. → Refit onto templates/molecules in
  their phases.
- [ ] **1.15 minor · DRY** — modal/drawer cluster ×9 (`new-project-modal`, `authoring-drawer`,
  `pin-upgrade-section`, `welcome-modal`, `path-picker-dialog`, `beacon`, `side-panel`,
  `explorer/confirm-dialog`, + duplicated close-button markup in `search-overlay` +
  `side-panel`). → Standardise on FormDrawerPage + shared CloseButton atom (icon, per mock).
- [ ] **1.16 minor · Budget** — `explorer/explorer-interactions.tsx` (354),
  `explorer/side-panel.tsx` (307), `use-explorer-canvas.ts` (301): files > 300 lines (functions
  all under budget). → Optional split, low priority.

Checked clean: no render function exceeds ~42 lines; `ge-canvas-preview` is a deliberate
conformance-suite host (not dead); `build/board/page.tsx` is a thin landing (not a dup);
`placeholder-page.tsx` live.

## 2. Frontend — logic layer (`lib/`, `types/`, hooks, `app/api`)

Overall: well-decomposed (1 file > 300 lines, no functions > 50 lines, one toast system). Bloat
concentrates in the **API proxy layer**.

- [ ] **2.1 major · DRY/SOLID** — three parallel "forward to backend + error envelope" helpers:
  `lib/build/backend-proxy.ts`, `lib/onboarding/backend-proxy.ts`, `lib/explorer/proxy-forward.ts`
  (`unwrapErrorEnvelope` byte-identical in two). → Collapse to one `forwardToBackend()`; delete
  the other two.
- [ ] **2.2 major · DRY** — inline try/catch-fetch-forward block copy-pasted across ~40 routes
  under `app/api/**` (44 files call `fetch` directly; e.g. `tenancy/workspaces/route.ts:33`,
  `billing/usage/route.ts:31`). → Route all through the 2.1 helper.
- [ ] **2.3 major · Inconsistent** — two error conventions: 503+`store_unavailable`
  (`app/api/proxy/**`) vs 502+`upstream_unavailable` (everywhere else), plus a variant skipping
  FastAPI `{detail}` unwrap. → One status/key convention in the 2.1 helper.
- [ ] **2.4 major · DRY (security)** — SPARQL-injection escaping implemented 3 ways:
  `lib/explorer/sparql-safe.ts:21`, `lib/glossary/sanitize-search-term.ts:8`, inline in
  `app/ce/instances/build-browse-query.ts:11`. Divergence = injection risk. → Centralise in
  `sparql-safe.ts`; import everywhere.
- [ ] **2.5 minor · DRY** — IRI local-name extraction ×3: `lib/instances/kind-slug.ts:26`,
  `app/ce/instances/use-inspector.ts:34`, `app/ce/instances/authoring-drawer.tsx:33`.
  → One `localName(iri)` util.
- [ ] **2.6 minor · Complexity/SOLID** — `lib/explorer/renderer-adapter.ts` (633 lines):
  ~170-line god-interface aggregating every canvas concern. → Split along impl-file seams or
  document as deliberate facade.
- [ ] **2.7 minor · Inconsistent** — 17 Build/settings components call `fetch` inline while
  Explorer uses typed lib clients. → Standardise on lib clients per area when touched.
- [ ] **2.8 minor · DRY** — ad-hoc date formatting ×3 (`settings/workspaces/workspaces-panel.tsx`,
  `app/audit/page.tsx`, `ce/brand/brand-list.tsx`). → Add `formatDate` util if a 4th appears.

Checked clean: no dead exports (spot-check of 9 explorer utils), no feature flags, no
single-implementation factories beyond the deliberate `lib/explorer/public-api.ts` facade,
0 functions > 50 lines, 0 param lists > 5.

## 3. Backend + shared

Headline: well-architected, not bloated. Auth centralised (`get_current_principal` ×122 via
`Depends`), all 53 routers mounted, no orphaned modules, near-zero commented-out code. Real issues:
copy-pasted scoping/auth helpers with error-contract drift, a few oversized functions, and a
`shared/` package not doing its cross-package job. False positives dropped after verification:
`ai/providers`, `ScmDriver`, `Extractor` (legitimately multi-implementation), `cost.py`/`costs.py`
(distinct write/read sides), `operations/pipeline.py` vs `requests/pipeline.py` (different domains).

- [ ] **3.1 major · DRY + error-shaping** — `_resolve_workspace_id` copy-pasted ×6
  (`routers/functions.py:27`, `routers/layout.py:171`, + metrics/validate/ontology/brand) and
  **drifted**: same condition raises `HTTPException(400, "no_active_workspace")` in one,
  `LayoutApiError(422, "missing_workspace_id")` in another. → One shared
  `resolve_workspace_id(principal, requested)` dependency; one canonical status+error key.
- [ ] **3.2 major · DRY (security-adjacent)** — `_authorize_read` duplicated ×5
  (`routers/functions.py:34`, `routers/brand.py:45`, + metrics/validate/ontology), each a thin
  wrapper over `enforce_workspace_role`. → Single `authorize_workspace_read()`; delete the copies.
- [ ] **3.3 major · SOLID/complexity** — `dashboard/generate.py:207` `generate_widget_stream` is
  **152 lines** (SSE streaming + intent + persistence + error shaping in one body). → Extract
  stages.
- [ ] **3.4 major · SOLID/complexity** — `dashboard/bindings.py:345` `_collaboration_activity` is
  **117 lines**. → Decompose per data source.
- [ ] **3.5 major · Cross-package/DRY** — `@weave/shared` onboarding content has **zero imports in
  frontend**, and backend hand-mirrors it in `onboarding/exercises.py` ("Keep this in sync… by
  hand") — drift risk, shared package serving no one. → Design decision: pick the real source of
  truth (Python registry or generated artefact) before touching code.
- [ ] **3.6 minor · DRY** — identical `_local_name(iri)` one-liner copy-pasted ×8
  (`routers/instances.py:62`, `sdkgen/ir.py:134`, `ontology/resource.py:40`,
  `ontology/catalogue.py:51`, `functions/registry.py:35`, `instances/violations.py:16`,
  `nl_query/translator.py:83`, `onboarding/hammerbarn_seed/compile.py:67`). → One
  `rdf/local_name.py` util. (Mirror of frontend finding 2.5 — same concept duplicated in both
  stacks.)
- [ ] **3.7 minor · Complexity budget** — functions 70–98 lines: `requests/pipeline.py:135` (98),
  `generation/service.py:254` (93), `operations/pipeline.py:318` (79) + `:215` (74),
  `ingest/worker.py:36` (70), `routers/briefs.py:44` (72), `routers/ingest.py:122` (84; carries a
  `# noqa: PLR0913` waiver — over-parameterised). → Extract sub-steps; params object for the
  waiver'd one.
- [ ] **3.8 minor · Complexity budget** — 16 files > 300 lines; biggest: `build/orchestrator.py`
  (647), `routers/dashboard.py` (531), `routers/ontology.py` (488), `routers/onboarding.py` (472),
  `dashboard/bindings.py` (470). `hammerbarn_seed/content.py` (588) is static seed data — leave.
  → Split largest routers by resource.
- [ ] **3.9 minor · Dead code** — 10 Pydantic models with zero external references:
  `schemas/generation.py` (`GatePassed`), `schemas/onboarding.py` (`TourProgressOut`,
  `DismissalOut`, `ExerciseCompletionOut`, `ActivationOut`), `schemas/gates.py` (`CommandResult`,
  `PreScaffoldFinding`), `schemas/dashboard.py` (`ComponentTypePatch`), `schemas/authoring.py`
  (`ImportCollisionResponse`), `schemas/ontology.py` (`VersionsQueryParams`). → Delete or wire up.
- [ ] **3.10 minor · Dead code** — `shared/onboarding/content/contextual-help.ts`: referenced only
  by its own test, not in the barrel. → Delete or add to barrel if intended.
- [ ] **3.11 minor · Dead flexibility (documented)** — `onboarding/path_resolver.py`
  `needs_choice` always False in M1 (waiting on a multi-role source that doesn't exist). → Leave
  (documented) or drop until the identity contract lands.
- [ ] **3.12 minor · YAGNI (documented seams)** — single-implementation Protocols:
  `connectors/client.py:71` (`StubConnectorClient`, connectors deferred to v1.0),
  `audit/emitter.py:54`, `ingest/extractors.py:32`. → Accept; collapse if second impl never
  arrives.
- [ ] **3.13 minor · Naming** — `build/cost.py` vs `build/costs.py`: genuinely distinct
  (write-side vs read-side) but a 3am foot-gun. → Rename pair (e.g. `cost_write.py` /
  `cost_read.py`).

Verified clean: all 53 routers mounted; no orphaned modules; auth/tenant DRY good at the boundary
(3.1/3.2 are the exception); `shared/` itself lean (1,367 LOC) — its problem is consumption (3.5),
not bloat.

## 4. Repo-wide non-app surface (scripts, CI, docker, tests, docs, harness)

Bottom line: in good shape — one solid major (CI copy-paste), rest minors. Findings marked
**[governance]** touch `.claude/**` and need an advisor consult per
`.claude/rules/harness-governance.md` before fixing.

- [ ] **4.1 major · DRY** — `.github/workflows/ci.yml:67-73,110-118,235-243,285-293,365-373`:
  identical `docker compose up … --wait` + 8-line oxigraph-readiness polling block copy-pasted
  across 5 jobs; `uv sync` + migrate preamble duplicated in 4. → Extract a composite action
  (`.github/actions/stack-up`); ~60 lines collapse, readiness fix becomes one-place.
- [ ] **4.2 minor · Dead [governance]** — `.claude/scripts/modules/circular_deps.py`: 71 lines,
  "disabled pending ESM port", scans CommonJS `require()` in an ESM/TS repo, not in the hook
  dispatch table. → Delete module + HARNESS.md row (advisor consult required).
- [ ] **4.3 minor · YAGNI/dead** — `scripts/m2_gate/build_m2_gate_bundle.sh`: one-off M2
  release-gate evidence bundler, referenced by nothing (sibling `invariants_check.py` IS wired
  into CI; this isn't). → Confirm M2 gate signed off, then delete or annotate as kept evidence.
- [ ] **4.4 minor · YAGNI** — `scripts/benchmarks/ce-perf/run_brand_benchmark.py` +
  `run_metrics_benchmark.py`: not wired to any CI gate (only `run_benchmark.py` +
  `run_view_save_benchmark.py` run). → Confirm still needed post-milestone; else retire script +
  paired test together.
- [ ] **4.5 minor · DRY (deliberate?)** — `e2e/ui-verify/`: second self-contained Playwright
  install/config, separate from the frontend's (harness `ui_verify.sh` driver). Not dead — but a
  duplicate browser toolchain + lockfile to maintain. → Leave if isolation is deliberate; record
  the dual-Playwright cost.
- [ ] **4.6 minor · Bloat [governance]** — `.claude/scripts/modules/stop.py` (366 lines): largest
  harness module by far. → Split along stop-hook concerns (advisor consult required).
- [ ] **4.7 minor · Stale** — `SCRATCHPAD.md` + `IDEAS.md` tracked at repo root (working scratch,
  last touched 2026-07-09). → Move to `docs/` or drop from git.
- [ ] **4.8 minor · Stale** — root `logo.png` (495 KB): distinct blob from
  `packages/frontend/public/logo.png`; referenced by `docs/design/mocks/mock-v5-delta.html` and
  used 2026-07-17 as the source for `docs/design/logo-mark.svg`. → Keep as brand source but move
  to `docs/design/` (and repoint the mock), or shrink; don't delete blindly.
- [ ] **4.9 minor · Stale docs** — `docs/design/MORNING-REVIEW.md`,
  `design-assessment-2026-07-09.md`, `poc-ia-proposal.md`: point-in-time docs alongside durable
  references; `poc-ia-proposal.md` is partially superseded (phase-pill vocabulary overruled by
  `.claude/memory/feedback_no_phase_pills.md`). → Reconcile against `visual-direction.md` /
  `v1-design-requirements.md`; archive the superseded parts.

Checked clean (don't re-audit): Makefile + docker-compose tight; all backend/frontend deps used
(single HTTP client, single JWT lib, single RDF stack; jscpd/stryker/mutmut/bandit invoked by
QA/engineer agents, not dead); all 10 terraform modules wired (staging/prod tfvars-only stubs are
a documented HITL gate); prototypes/ untracked; no committed build artifacts; workflows distinct
and live; local-vs-CI semgrep duplication is documented intent.
