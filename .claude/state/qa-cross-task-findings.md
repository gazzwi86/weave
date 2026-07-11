# QA cross-task findings ledger

Coordinator-owned (ADV-004: lane subagents never write `.claude/state/**`; QA agents surface findings
in their reports and the coordinator records them here). Findings that span more than one task, or a
shared/pre-existing dependency, so a single fix closes several tasks.

Status legend: OPEN · IN-PROGRESS · RESOLVED (with fix commit).

---

## XT-001 — 401 auth-error contract mismatch (shared dependency)

- **Severity:** Major · **Status:** RESOLVED on `feature/BE-EPIC-001` (`0064eea` + `9961c85`) — lands on
  main when BE-EPIC-001 merges, retroactively closing BE-TASK-001's AC-3. Fix: custom `UnauthorisedError`
  + `unauthorised_exception_handler` (JSONResponse) → top-level `{"error":"unauthorised"}` +
  `Www-Authenticate: Bearer`; `token_ttl_exceeded`/`session_revoked` left on their own contracts. Full
  backend suite green, no other router regressed.
- **Affects:** BE-TASK-001 (AC-3), BE-TASK-003 (AC-5) — same literal AC wording, same shared code.
- **Found by:** BE-TASK-003 QA (live in-process app verification, not test-suite self-report).
- **Symptom:** unauthenticated request returns `{"detail": "missing bearer token"}` with no
  `Www-Authenticate` header. The AC contract is `{"error": "unauthorised"}` + `Www-Authenticate: Bearer`.
- **Root cause:** shared `_bearer_token` / `get_current_principal` in
  `packages/backend/src/weave_backend/auth/dependencies.py:42` (pre-existing platform code — not
  introduced by either task's diff). Mapped tests assert `status_code == 401` only, so the body/header
  mismatch was never caught. BE-TASK-001 merged to main (#24) carrying the gap.
- **Fix (single point, root-cause):** normalise the shared dependency to emit the AC contract on 401 for
  every router. Dispatched to the BE-TASK-003 lane with a blast-radius guard (full-suite verify;
  stop-and-report if the change breaks a large set of unrelated tests, which would mean the contract is
  not platform-wide and needs a dedicated auth task). Closing this closes BE-TASK-001's AC-3 too.
- **Classification:** interface.

---

## XT-002 — spike-mode write-back guard is unwired

- **Severity:** Major (deferred) · **Status:** OPEN (blocked — target route doesn't exist yet)
- **Affects:** BE-TASK-005 (AC-7 defines the guard), BE-TASK-006 / BE-TASK-007 (whichever ships
  `POST /api/operations/apply` / CE-WRITE-1).
- **Found by:** BE-TASK-005 QA.
- **Symptom:** `assert_not_spike_write_back` (`build/guards.py`) is correctly unit-tested but never wired
  to any route or middleware — `/api/operations/apply` does not exist in the codebase yet. AC-7's literal
  promise ("spike-mode write-back attempts MUST return 403") is therefore not verifiable end-to-end.
- **Action:** whichever task adds the write-back route MUST wire the guard in and add an HTTP-level 403
  test. Not fixable in BE-TASK-005 (YAGNI — no route to guard). Left unit-tested only.
- **Classification:** deferred / cross-task (no defect in BE-TASK-005 itself).

---

## XT-003 — CE-READ-1 grounding forwards no tenant/auth context

- **Severity:** Major (deferred) · **Status:** OPEN (blocked — CE-READ-1 endpoint doesn't exist yet)
- **Affects:** BE-TASK-002 (briefs grounding), the task that ships CE-READ-1.
- **Found by:** BE-TASK-002 QA (forward-looking).
- **Symptom:** `briefs/ce_read_client.get_bpmo_context` forwards no Authorization/tenant context to
  CE-READ-1, and `routers/briefs.py` never verifies the caller's tenant owns the `project_iri` path param
  before grounding. Same pattern as the existing `ce_version_client`. Not testable/blockable today (the
  real CE-READ-1 endpoint doesn't exist), but becomes a **cross-tenant data-exposure risk** once it lands.
- **Action:** when CE-READ-1 ships, forward tenant/auth context on the grounding call and add a caller-owns-
  `project_iri` check + a cross-tenant-denied test.
- **Classification:** deferred / cross-task (potential tenancy hole once dependency exists).

---

## XT-004 — ui_verify Lighthouse can't reach auth-gated routes (harness gap)

- **Severity:** Major · **Status:** OPEN (harness change — needs advisor consult + HITL per governance)
- **Affects:** every auth-gated UI route in every epic (surfaced by CE-TASK-010 on `/explorer`).
- **Found by:** CE-TASK-010 QA (read `.lighthouse.json` directly — `finalUrl` was
  `/auth/login?return_to=%2Fexplorer`, not `/explorer`).
- **Symptom:** `ui_verify.sh`'s Lighthouse step has no scripted login, so for any auth-gated route it
  measures the sign-in redirect page, not the real target — Lighthouse-100 conformance on authenticated
  screens is silently UNVERIFIED (it also runs against `next dev`, unoptimised, not a prod build).
- **Action:** `ui_verify.sh` needs a scripted login (mock-OIDC token injection) before the Lighthouse
  pass on auth-gated routes. This is a **harness change** (`.claude/scripts/**`) → advisor consult +
  HITL required; do NOT let a lane fix it inline. Until then, Lighthouse PASS on any auth-gated screen
  is not trustworthy — the functional Playwright + axe layers still hold.
- **Classification:** dependency / harness.

---

## XT-005 — Explorer kind→shape pairing deferred (WCAG 1.4.1)

- **Severity:** Minor (deferred) · **Status:** OPEN (brief-sanctioned deferral)
- **Affects:** CE-TASK-010 (single ellipse in M1), CE-TASK-011/CE-TASK-012/CE-TASK-013 (richer node rendering).
- **Found by:** CE-TASK-010 QA.
- **Symptom:** node meaning is conveyed by colour only (single ellipse shape), so WCAG 1.4.1 ("meaning
  never colour-only") is not met. Explicitly deferred by the brief's Design Decision table (OQ-08:
  single ellipse in M1) — NOT a TASK-002 defect.
- **Action:** whichever GE task introduces kind→shape/icon pairing must close WCAG 1.4.1. Tracked, not
  fixed in M1.
- **Classification:** deferred / cross-task.

## XT-BE006-1 — POST /api/projects/{iri}/runs happy-path untested

- **Severity:** Minor · **Status:** OPEN
- **Affects:** BE-TASK-006 (dark-factory run engine); closable by BE-TASK-007 (wires PLAN consumption).
- **Found by:** BE-TASK-006 QA (live mutation pass).
- **Symptom:** every integration test drives `StateSpine` directly or hits the 409/404 error branches;
  the 202 happy-path (real dispatch through the HTTP layer) has zero coverage. Not an AC violation — no AC
  requires HTTP-driven backlog seeding — but the primary run entrypoint is unproven end-to-end.
- **Action:** add an HTTP happy-path integration test when BE-007 wires PLAN to consume a real backlog.
- **Classification:** test-coverage / cross-task.

## XT-BE006-2 — turn_cap_override not clamped against PLAT-SETTINGS-1 cascade

- **Severity:** Minor · **Status:** OPEN (ponytail-marked, upgrade path in `routers/runs.py`)
- **Affects:** BE-TASK-006 (`routers/runs.py` `_effective_turn_cap`).
- **Found by:** BE-TASK-006 QA (dev #4 adjudication).
- **Symptom:** `turn_cap_override` is applied as a direct override, not clamped against PLAT-SETTINGS-1's
  cascade despite the API-contract prose "capped by (PLAT-SETTINGS-1)". AC-1's testable text only requires
  a default-60 configurable cap, so this is a WARN not a FAIL. Limited blast radius — an authenticated
  principal can only raise their own tenant's cap.
- **Action:** clamp the override to the settings-resolved ceiling before this surface is exposed more broadly.
- **Classification:** deferred / spec-prose-vs-AC gap.

## XT-BE006-1 status update (from BE-TASK-007 QA)

- **Re-targeted:** BE-TASK-007 did NOT close this — it never touched `routers/runs.py`. The prediction
  that BE-007 would wire the POST /runs happy path was wrong (BE-007's scope is gates only). Re-point the
  HTTP 202 happy-path test to **BE-TASK-009**. Still OPEN.

## XT-BE006-1 status update (from BE-TASK-009 QA) — SECOND mis-target, un-target from a specific task

- **Not closable by BE-TASK-009 either** (second mis-target). BE-009 is `POST .../deploy`, a different
  router; it touches zero lines of `routers/runs.py`. QA grepped the whole `tests/` tree: no test uses
  real ASGI dispatch (`TestClient`/`ASGITransport`) against `routers/runs.py`'s 202 happy path — the one
  ASGI file (`tests/integration/test_runs_api.py`) deliberately builds the run spine directly and only
  drives the 409 branch through the real client. **Action:** this finding belongs to whichever future
  task adds an ASGI-level TestClient 202 test for `start_run_route` — do NOT auto-attach it to the next
  BE task by prediction (that guessing is what caused two mis-targets). Still **OPEN**, now un-targeted.
  Classification: test-coverage.

## XT-BE008-2 re-verification (from BE-TASK-009 QA) — independently confirmed fixed

- BE-009 QA re-checked the `base_tree` fix directly (not on the summary's word): `repo_bootstrap/drivers.py`
  resolves the real tree sha via `GET /repos/{full_name}/git/commits/{parent_sha}` before POSTing
  `base_tree`; `test_repo_bootstrap_drivers.py` 13/13 pass. Remains RESOLVED — confirmation recorded.

## XT-BE007-1 — TaskBrief schema has no `design_decisions` field (DoR can never READY on real data)

- **Severity:** Major · **Status:** OPEN (urgent — silently defeats the DoR gate once wired live)
- **Affects:** BE-TASK-002 (owns the `TaskBrief` schema); the DoR-gate callers
  `routers/{runs,gates,tasks,specs}.py` (via `build/gates.py:run_dor_gate`). **NOT BE-TASK-009** —
  BE-009 QA confirmed `deploy/service.py` never imports or calls `run_dor_gate` and never references
  `design_decisions`; there is no DoR wiring in BE-009 (corrects the earlier BE-009 attribution).
- **Found by:** BE-TASK-007 QA (traced the exact code path, not a guess); re-confirmed by BE-TASK-009 QA.
- **Symptom:** `routers/briefs.py:96` stores `content=brief.model_dump(mode="json")`, but `TaskBrief`
  (`briefs/schema.py`) has no `design_decisions` field. Every real brief created via BE-002's API therefore
  lacks it, so DoR's `design_decisions` completeness check can **never** return READY on production data —
  only on hand-seeded test dicts. BE-007's gate logic is correct; the defect is BE-002's schema.
- **Action:** extend `TaskBrief` (BE-002) with a `design_decisions` field before BE-TASK-009 wires DoR live,
  else the gate is a silent no-op on real briefs.
- **Classification:** interface / cross-task (schema gap upstream of a correct gate).

## XT-BE008-1 — secret-scan gate false-negative on unquoted .env-style secrets

- **Severity:** Medium · **Status:** OPEN
- **Affects:** BE-TASK-008 (`generation/secret_scanner.py` + `secret_patterns.json`), and any task
  relying on the secret-scan safety gate to block credential leakage in generated apps.
- **Found by:** BE-TASK-008 QA (pinned with a test).
- **Symptom:** the secret-scan regex requires a quoted value (`api_key = "…"`); an unquoted
  `.env`-style assignment (`API_KEY=AKIA…` with no quotes) is not matched, so a generated app could
  carry a plaintext secret past the gate.
- **Root cause:** the regex is the one specified verbatim in the **task brief's own implementation
  hint** — this is a spec gap, not an engineer deviation. Gate logic is otherwise correct.
- **Action:** broaden the pattern to cover unquoted assignments (and ideally reuse the platform
  secret-scan hook's regex set) before the generate endpoint is exercised on real client apps.
- **Classification:** deferred / spec-vs-implementation gap.
- **Epic-close (BE-EPIC-008) disposition (2026-07-07):** NOT taken as a cheap ride-along fix.
  Although this epic touched `generation/secret_scanner.py`, broadening a security gate's regex
  carries false-positive risk (could block legitimate generated apps) and the "reuse the platform
  regex set" path is non-trivial — so it fails the "low-risk + cheap" bar for epic-close remediation.
  Deferred to the phase-1 gate ledger sweep (Step 4), where a security change gets proper scrutiny.
  Age at defer: raised during BE-TASK-008 QA, ~same day. Still OPEN.

## XT-BE008-2 — AC-6 base_tree defect (RESOLVED — noted for BE-009 reuse)

- **Severity:** High · **Status:** RESOLVED on `feature/BE-EPIC-008` (`7ab5cc4`).
- **Affects:** BE-TASK-008 (owns `commit_workspace`), BE-TASK-009 (reuses it).
- **Found by:** coordinator hypothesis → BE-TASK-008 QA confirmed real.
- **Symptom / fix:** `GitHubDriver.commit_workspace` sent a **commit** sha as `base_tree` (GitHub
  requires a **tree** sha) → every real call after `write_initial_commit` seeds `main` would 422
  against live GitHub; all mocks passed because none asserted `base_tree`. Fixed by resolving the
  parent commit to its tree (`GET /git/commits/{parent_sha}` → `tree.sha`). Recorded here because
  BE-009 reuses `commit_workspace` — the single fix protects it too; no separate BE-009 action.
- **Classification:** interface / cross-task (one fix closes both).

## XT-BE013-1 — `context_iri=project_iri` never parses under `settings/scope.py`'s IRI grammar (cascade dead beyond company)

- **Severity:** High · **Status:** PARTIALLY RESOLVED (`86eeb3b`/`e06642b`, `feature/BE-V1-EPIC-002`).
  The production-breaking half is fixed: `build/cost.py::resolve_rate_card` had NO fallback so every
  real dispatch produced an empty card / `RateCardConfigError` — now catches `InvalidScopeIri` and
  falls back to company scope like `resolve_budget_cap` does (both tested against the real project
  IRI). The **remaining half is DEFERRED to a schema follow-up** (ADR-013): domain/project-level
  overrides stay unreachable until `projects` gains a `domain_id` column AND `settings/scope.py`
  parses a project/domain scope IRI. Same root cause as ADR-012 — ONE `projects.domain_id` migration
  + grammar extension closes XT-BE013-1's remainder, ADR-012's dormant role overlay, and this cap
  cascade. Phase-gate ratification item.
- **Affects:** BE-V1-TASK-013 (AC-3 — Company→Domain→Project budget-cap cascade), BE-V1-TASK-012
  (rate-card resolution, `build/cost.py:64`, same pattern — no cascade AC was claimed there so it
  wasn't caught, but it has the identical gap), BE-V1-TASK-019 (Dashboard "capped at Domain" tile —
  will never render anything but "capped at Company").
- **Found by:** BE-V1-TASK-013 QA (traced `resolve_budget_cap` -> `settings/scope.py:scope_of`
  against the real `build_project_iri` format).
- **Symptom:** every real project IRI in this codebase is `urn:weave:project:{tenant_id}:{slug}`
  (`projects/model.py:build_project_iri`). `settings/scope.py`'s cascade grammar only recognises
  `urn:weave:tenant:{tid}:company` / `:domain:{did}` / `:ws:{wid}` / `:ws:{wid}:project:{pid}`.
  Calling `resolve_setting(..., context_iri=<real project_iri>)` therefore always raises
  `InvalidScopeIri` and falls straight back to the tenant's company scope — domain- and
  project-level overrides of `build.budget.cap_usd` (and `build.rate_card`) are silently
  unreachable in production. `resolve_budget_cap`'s own docstring self-discloses this
  ("...inert until a follow-up threads a domain-aware project IRI") but it isn't flagged as a
  known-gap anywhere outward-facing (DoD, progress summary).
- **Root cause:** two IRI grammars from different specs (Build's `urn:weave:project:{tid}:{slug}`
  vs Platform-Settings' `urn:weave:tenant:{tid}:...`) were never reconciled; TASK-013's unit test
  proves the cascade machinery in isolation with a fabricated IRI that conforms to the *settings*
  grammar, not the one the orchestrator/router actually pass — a tautological test relative to the
  real call path.
- **Action:** either (a) extend `settings/scope.py`'s grammar to parse Build project IRIs (thread
  a domain-aware project IRI per the docstring's own suggestion), or (b) have Build resolve/pass a
  settings-scope-shaped context IRI at the call site. Either way, AC-3 needs a real fix plus a test
  that exercises the actual production project_iri shape, not a fabricated one.
- **Classification:** interface / spec gap (two unreconciled IRI grammars).

## XT-BE004-1 — codegen injection: unescaped CE-fetched `fn_iri`/`fn.name` in SDK emitters
- **Severity:** SERIOUS (security) · **Status:** RESOLVED (`bb2aea0`) — two-layer fix (charset-reject at IR + percent-encode at template) · **affects:** [BE-V1-TASK-005]
- `fn.fn_iri` (CE `/api/functions` JSON, NOT IRI-syntax-constrained) interpolates unescaped into an
  executable string literal in `sdkgen/templates/typescript/index.ts.j2:29` + `templates/python/client.py.j2:32`.
  A crafted value breaks out → injects code that passes real tsc/mypy silently → arbitrary code in every
  downstream consumer's build. QA red tests `7c23481` pin it.
- **Fix:** validate/reject `fn_iri`+`fn.name` against a safe IRI/identifier charset in `ir.py::map_fn`
  (IR boundary, named error like `UnmappableConstraint`) — not template-level escaping alone.
- **TASK-005 HELD** until this lands (SDK Trigger API wires this pipeline into a live CE-driven path).
- **General lesson:** any codegen from external/registry data MUST validate identifiers at the IR boundary
  before emission; the compile gate (tsc/mypy) does NOT catch injected valid code.

## XT-PLAT010-1 — dashboard widget refresh route: IDOR sibling + AC-7 read-path staleness gap
- **Severity:** SERIOUS (authorization) + MODERATE (spec-conformance) · **Status:** OPEN — sent back to Engineer · **affects:** [PLAT-V1-TASK-011, PLAT-V1-TASK-014, PLAT-V1-TASK-016]
- `refresh_widget_route` (`packages/backend/src/weave_backend/dashboard/router.py`) checks `scope`
  but not `owner_principal_iri`, unlike its sibling `delete_widget_route` (which the engineer
  self-caught and fixed). Any tenant member can trigger a refresh on -- and thereby mutate
  `status`/`fetched_at` and observe them for -- another user's private `scope='user'` starter
  widget by id-guessing a v4 UUID. Proof (red): `test_refresh_other_users_starter_is_not_found`.
- Separately, AC-7's "stale even without a failed refresh" clause is not honoured on the GET read
  path -- `derive_status()` (the pure age-aware function) is only called inside the refresh flow,
  never in `list_widgets_route`. A widget written `fresh` and never refreshed again stays `fresh`
  forever in every GET response regardless of `fetched_at` age. Proof (red):
  `test_stale_bound_renders_on_read_without_failed_refresh`.
- **Action:** Engineer mirrors the delete-route owner guard onto refresh, and wires `derive_status`
  into `list_widgets_route` (and the frontend `widget-tile.tsx` render path, which also trusts
  `widget.status` verbatim).
- **General lesson:** when a route pair shares an ownership model (delete/refresh both act on a
  single widget by id), fixing an IDOR on one sibling route is not sufficient -- grep every other
  route touching the same resource for the same missing guard, per team-lead's original ask.
  Downstream tasks touching refresh-adjacent or read-path widget code (011/014/016) should confirm
  this fix landed before building on top of it.


## QA-TASK-005-1 — RESOLVED (2026-07-11)
BE-V1-TASK-005: `_generate_and_commit` post-commit bookkeeping ran outside the fail-closed try/except →
desync if it threw after commit_workspace (git commit landed, run never marked failed, last_sdk_version_iri
stale) — violated ADR-006 §3. Fixed `e9580f0`: extended fail-closed to cover post-commit bookkeeping, marks
run failed via fresh conn + records commit_sha. strict-xfail proof test flipped to green. RESOLVED.

## XT-PLAT010-2 — dashboard E2E mocks a server-component fetch via page.route() (proves nothing)
- **Severity:** Major (Law B honest-E2E) · **Status:** OPEN — **BLOCKS EPIC-001 close (ui_verify --full)**
- **Affects:** PLAT-V1-TASK-010 (owns `tests/e2e/dashboard-widgets.spec.ts`, `af388d8`); the axe a11y test
  that runs against the same degraded render; TASK-011/014/016 (EPIC-001) inherit the honest-E2E gate.
- **Found by:** PLAT-010 re-QA (ran the spec — getByText("Entities in model") times out; real backend
  renders zero tiles, fixture never applies).
- **Symptom:** `page.route()` mock of `GET /api/dashboard/widgets` intercepts nothing because `DashboardPage`
  is a Next.js Server Component (fetch runs server-side in SSR, not the browser). The E2E proves only
  login+whoami, not widget rendering. Asserts fixture literals (128, "Counts pending") only the dead mock supplies.
- **Action:** rebuild the dashboard E2E to assert against a REAL seeded backend (real values), or introduce a
  server-side-capable interception layer (MSW/route-handler mock). Non-trivial test-architecture — a focused
  follow-up, not a TASK-010 re-fold. MUST land before EPIC-001's ui_verify --full close gate passes.
- **Classification:** test-architecture / Law B (real E2E asserting backend state).

## XT-CE012-1 — ingest proposals list silently truncates at 50 (pagination unwired) — RESOLVED (2026-07-11)
- **Severity:** Major · **Status:** RESOLVED `8bf66d7` (limit/offset query params + has_more field; red test b5016bc green)
- **Affects:** CE-V1-TASK-012 (`routers/ingest.py::list_proposals_route`); **downstream consumers TASK-013
  (doc-extractor), TASK-014 (embeddings), TASK-019 (Import & Ingest page)** all render/consume this list endpoint
  — a real document plausibly yields 50+ extraction candidates, so not a theoretical edge case.
- **Found by:** CE-012 QA (seeded 51 proposals, only 50 returned; proof test `b5016bc`).
- **Symptom:** `GET /api/ingest/jobs/{id}/proposals` never overrides the store's `limit=50` default + exposes no
  pagination query params + `ProposalsListResponse` has no has_more/total → proposals past #50 permanently
  invisible (unreviewable/unacceptable). Summary counts are correct (unbounded query), so the gap is silent.
- **Fix (retry-1):** surface limit/cursor query params on the route + has_more/total on the response schema.
  Store layer already has the params; router just never surfaced them (incomplete wiring, not a design gap).

### XT-PLAT010-2 — fix path CLARIFIED (2026-07-11)
plat011-eng3 confirmed the Playwright infra spins a REAL uvicorn backend (:8000 health-gated) + mock-OIDC
(:9001) via `playwright.config.ts` webServer — NOT docker/mocked. `dashboard-widgets.spec.ts` already runs
against it. So the fix for XT-PLAT010-2 is NOT a new interception layer: DROP the `page.route()` mock of
`GET /api/dashboard/widgets` (which fails because DashboardPage is a Server Component — SSR fetch, not browser),
and assert against the REAL seeded backend (seed widgets, load /dashboard, assert the real tiles render).
Same real-backend pattern TASK-011's `test_prompt_to_widget_stream` uses (generate → GET widgets → assert).
Still an EPIC-001-close blocker (ui_verify --full); now a straightforward rewrite, not a test-arch overhaul.

## XT-CE-KEYPROPS-1 — CE-READ-1 bulk graph load carries no key_properties (blocks real property/heatmap data)
- **Severity:** Major (feature-latent) · **Status:** OPEN — formalized per aggregation rule (2 tasks hit it: TASK-020, TASK-021)
- **Affects:** CE-V1-TASK-020 (property filters ship data-latent), CE-V1-TASK-021 (heatmap all-grey until it lands),
  + any future Explorer feature needing per-node property values.
- **Symptom:** `map-rows-to-elements.ts` only sets id/label/bpmo_kind at bulk graph load; `key_properties` is
  lazy-fetched per-node on click, never in the bulk CE-READ-1 SPARQL rows. So property filters + heatmap value
  colouring have no data to act on end-to-end — mechanism proven, user payoff not live.
- **Fix:** plumb a BOUNDED key_properties set into the bulk graph-load query over CE-READ-1 (10k-node perf-sensitive
  — bound it). Its own CE task (out of scope for a filters/overlay panel task).

## A11Y-FILTERPANEL-1 — disabled toggles unreachable by keyboard (aria-disabled swap)
- **Severity:** Minor (a11y polish, not WCAG-AA fail) · **Status:** OPEN · **Owner:** filter-panel.tsx origin (predates TASK-021)
- `overlay-panel.tsx` OverlayToggleRow + `filter-panel.tsx` LayerToggleList (:169) use native HTML `disabled`,
  which removes the control from tab order — so the mutual-exclusion tooltip never reaches keyboard/SR users
  (the code comment wrongly claims it stays focusable). Not a WCAG-AA failure (disabled controls are exempt),
  axe doesn't flag it. Fix: swap `disabled` → `aria-disabled="true"` on both to keep the sibling focusable.

## XT-OVERLAY-ENGINE-1 — activate() leaks onElementRemoved subscription on same-id re-activate
- **Severity:** Minor (not reachable today) · **Status:** OPEN · **Affects:** TASK-021 (owns overlay-engine.ts —
  the dedup fix belongs there), TASK-030 (a real "re-run impact on same node" UI first makes it reachable).
- **Found by:** CE-028 QA (reading overlay-engine.ts).
- **Symptom:** `OverlayEngine.activate()` overwrites an existing same-`id` entry WITHOUT calling `remove()` first,
  so the prior overlay's `onElementRemoved` subscription stays alive → re-pinning the same source without
  unpinning first double-fires the "Pinned trace source deleted" notice on the next delete. NOT reachable via any
  tested/specified AC-4 flow (single pin→delete→clear only).
- **Fix:** in `overlay-engine.ts::activate()`, `remove(id)` an existing same-id entry before overwriting (dedupe).
- **Tripwire:** CE-028 QA test `bd83895` asserts the current (buggy) double-fire as expected-today — when
  overlay-engine is fixed, that test goes RED (signal to update it alongside the fix).

## XT-CE003-1: write path hardcodes xsd:string (graph_ops.py:52) — 2026-07-11
`operations/graph_ops.py:52` builds every property literal as `Literal(value, datatype=XSD.string)`, never consulting
the property's `sh:datatype`. Surfaced by CE-003: `effectiveDate` (only xsd:date property in the brand shape) fails
SHACL on real-API write → AC-003-01 unreachable. Fix in-flight on feature/CE-V1-EPIC-004 (ad67501): datatype-driven
coercion from the active shape, default xsd:string preserved (minimal blast radius). **Shared write path — other
write consumers (CE-023 edit proxy, CE-013 ingest accept) should be re-checked at their epic close** that typed
properties (if any) coerce correctly. Status: OPEN (fix in progress).

## XT-CE013-2: use-ingest accept/reject silently resolve on non-422 errors — 2026-07-11 (FIXING, retry 1)
`app/ce/chat/use-ingest.ts:140-155` — accept/reject only guard HTTP 422; any other non-2xx (502/500/401) falls
through to `setProposalStatus("accepted"|"rejected")` with NO graph write → false committed state, buttons hidden,
no retry. Breaks AC-002-05 "never silently resolve." Blocker, class=logic. Fix in-flight (ae06cdeb): 2xx guard on
both + error-card state on other statuses + error-path tests (the 502/500 coverage gap). QA edge test 71e252a
(null matched_iri) already committed. Status: FIXING.
