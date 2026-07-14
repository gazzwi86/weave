# QA project-level escalation queue

Per Law #11 (aggregation rule): once the same recommendation appears in two consecutive
QA reports, it is escalated here (severity `Project`) and stops being repeated in
per-task reports.

## PROJ-001: Progress-summary section headers don't match the spec-template's literal names

- **Title:** Engineer progress summaries use ad-hoc section headers (e.g. "Decisions /
  deviations from the brief", "Notes for QA") instead of `.claude/spec-templates/progress-summary.md`'s
  literal `Decisions Made` / `Assumptions Made` headers.
- **Severity:** Project
- **Raised in tasks:** PLAT-TASK-001 (QA report, as a per-task recommendation — not yet
  escalated at the time), PLAT-TASK-002 (QA report — same gap recurs, escalating now per
  Law #11 instead of repeating it a third time).
- **Evidence:** `.claude/state/summaries/PLAT-TASK-001.md` and
  `.claude/state/summaries/TASK-002.md` both carry substantively-equivalent content
  (assumptions/decisions are documented) under non-matching headers, so this is a
  naming/tooling-greppability gap, not a content gap — the QA preflight check in both
  cases passed on substance.
- **Owner:** Engineer persona (applies the template), enforced by Scaffold-phase (should
  bake the literal headers into whatever scaffolds new task progress-summary files).
- **Deadline:** Before the next task's progress summary is written (PLAT-TASK-003 or
  whichever task is next in the implement loop) — this is a near-zero-cost fix (rename
  two headers) and should not reach a third occurrence.

## PROJ-002: Repo merge settings contradict git-workflow.md §6 (squash on, merge-commit off)

- **Title:** GitHub repo has `allow_squash_merge: true`, `allow_merge_commit: false` — the exact
  inverse of the stacked-PR rule (never squash a stack base; merge-commit/rebase-merge only).
  A single squash-merge of an epic base breaks every child rebase.
- **Severity:** Project · **Raised in:** ADV-001 (advisor consult on PR #14).
- **Owner:** Human operator — changing repo settings is outside agent autonomy. Fix:
  `gh repo edit --enable-squash-merge=false --enable-merge-commit=true --enable-rebase-merge=true`.
- **Deadline:** Before the first stacked-epic base is merged (i.e. before merging any of #11–#13).
- **Status:** ✅ RESOLVED 2026-07-04 — operator updated the repo merge settings.

## PROJ-003: Advisor-consult trailer check not yet enforced at pre-commit

- **Title:** `harness-governance.md` requires an `Advisor-Consult: ADV-NNN` trailer on any
  harness-touching commit, but nothing verifies it at pre-commit — currently convention-only
  (backed by `permissions.ask` HITL on the enforcement core). The advisor (ADV-001) flagged this as
  a "required-soon" follow-up.
- **Severity:** Project · **Raised in:** ADV-001.
- **Owner:** Engineer (harness) — add a pre-commit check: if staged paths match the harness globs
  (see `harness-governance.md` scope), require the trailer + an existing `ADV-NNN.md` record. Itself
  a harness change → needs its own advisor consult.
- **Deadline:** Next harness-focused pass.

## PROJ-004: CI semgrep uses live `--config auto` ruleset (non-deterministic while blocking)

- **Title:** The now-**blocking** semgrep job runs `semgrep scan --config auto`, which pulls the
  live Semgrep registry ruleset each run. The container image is digest-pinned, but the *rules* are
  not — an upstream rule addition can redden an unrelated PR, and an upstream rule **rename** can
  silently invalidate a `nosemgrep` waiver (the 6 waivers are rule-id-scoped).
- **Severity:** Project · **Raised in:** ADV-002.
- **Owner:** Engineer (harness) — pin to a versioned policy (`--config p/<ruleset>` or a vendored
  rule pack) so the blocking gate is reproducible, or accept auto with eyes open and a runbook for
  triaging upstream rule drift. ci.yml is governance-exempt.
- **Deadline:** Before heavy reliance on the blocking gate (next CI-focused pass).

## PROJ-005: Per-PR mutation score is structurally capped ~62% (unit-only run)

- **Title:** The per-PR CI mutation job runs **unit tests only** (no services), which caps the
  score around 62%. Investigation (2026-07-04) found the surviving-mutant clusters are dominated by
  **SQL-string mutations** (`rbac`, `tenancy.*`, `settings.resolver` queries) and **AWS-client
  mutations** (`auth.agent`/`identity.registry` STS, `ai.providers` Bedrock) — mutants that only die
  under **integration tests with a live DB/AWS**, not unit mocks. So writing more unit tests cannot
  push the per-PR number to 70%.
- **Current design (ADV-002 follow-up):** the per-PR mutation job is now **blocking** at a **60%
  regression floor** (`MUTATION_SCORE_THRESHOLD=60` in ci.yml), catching real drops deterministically
  despite mutmut's few-point cross-env variance. The **strict ≥70% bar stays at the phase gate**
  (`mutation_gate` default), where services run and surviving mutants are triaged with human review.
- **Severity:** Project · **Raised in:** ADV-002.
- **Owner:** Engineer/QA. **Deterministic strict-70 backstop:** the `mutation-strict` CI job
  (main-push, boots postgres/redis/oxigraph/localstack, mutmut runs the integration suite too,
  enforces the strict 70% default) was added per ADV-003 so the 70% bar does not rest solely on the
  model-executed phase gate. **Its first main-push run must be validated** — the mutmut×integration
  runtime is unverified locally and may need the 30-min timeout tuned or the trigger moved to a
  nightly `schedule`.
- **Ratchet rule (ADV-003):** the per-PR `MUTATION_SCORE_THRESHOLD` floor moves **up only**, never
  down. If a PR reds the floor on suspected tool noise, the fix is evidence (rerun; compare killed
  lists), never a threshold drop. Revisit the floor upward whenever the unit-killable mutant pool
  grows.
- **Deadline:** Validate `mutation-strict` on the next main-push; raise the floor as unit-killable
  coverage improves.
- **VALIDATED (2026-07-05):** platform stack merged to main (PRs #17/#18/#19); `mutation-strict`
  ran blocking on the merge push (run 28725517537) and scored **77.3% vs the 70% threshold — PASS**.
  The deterministic tier works end-to-end. Remaining action: revisit the per-PR floor (60) upward
  as the unit-killable pool grows — otherwise this issue can close.
- **CLOSED / SUPERSEDED (2026-07-06, ADV-005):** the two-number design (per-PR 60 floor + strict 70)
  is collapsed to a **single 60% bar** enforced by both tiers, on explicit operator authorisation.
  The "gap to 70" this issue tracked is therefore moot: per-PR unit-only (~64.5%) and strict-with-
  services (~77.3%) both clear the single 60 bar, so main is green with one consistent number. The
  strict-70 deterministic backstop recorded above is **replaced** by the single-60 bar (rationale:
  ADV-005). Both tiers stay blocking; 60 is a floor with a recorded revisit-upward trigger (ratchet
  rule carries forward), not a ceiling. Note: the recent main redness was **not** a score failure but
  a mutmut collection crash (`test_ce_perf_benchmark.py`'s `parents[4]` breaking under the `mutants/`
  copy) — fixed in the ADV-005 change.

## PROJ-006: Second consecutive feature's Playwright E2E fully mocks the network (Law B gap)

- **Title:** Escalated per the Law #11 aggregation rule — the same recommendation ("add a
  Law-B-compliant real-backend E2E spec") has now appeared in two consecutive per-task QA reports:
  PLAT-TASK-008 (`billing.spec.ts` / `accessibility.spec.ts` billing case, `page.route()` mocked)
  and PLAT-TASK-009 (`compliance.spec.ts` / `accessibility.spec.ts` compliance case, also
  `page.route()` mocked). Both features' underlying logic IS genuinely proven against a live
  Postgres/Redis/LocalStack stack, but only via the Python docker-integration suite — never through
  a real browser + real Next.js proxy + real FastAPI + real DB round trip, which is what Law B
  actually requires ("also asserts backend state changed").
- **Root cause hypothesis:** no existing Playwright spec in this repo demonstrates the
  fully-real pattern for a *read-only* dashboard-style page (the closest precedent,
  `global-search.spec.ts`, drives a real backend but for a write-then-read flow) — so each new
  read-only view's E2E spec defaults to mocking, since there's no template to copy for "real GET,
  assert real DB-backed content."
- **Severity:** Project · **Raised in:** PLAT-TASK-008 QA, PLAT-TASK-009 QA (this pass).
- **Owner:** Engineer — add ONE reference Playwright spec (recommend: retrofit
  `compliance.spec.ts`, since `/compliance`'s backend route (`GET /api/audit/compliance`) needs no
  request body/mutation setup beyond seeding a couple of real audit entries via existing routes) that
  hits the real proxy → real backend → real Postgres, asserting the rendered numbers match a
  known-seeded DB state. Once that pattern exists, retrofit `billing.spec.ts` to match, and treat the
  pair as the template for all future read-only-view E2E specs.
- **Deadline:** Before the phase-1 gate's security review + mutation-testing pass (this task's own
  team-lead brief flagged the same gate as imminent) — do not let a third feature ship with this gap
  before the template exists.

## PROJ-007: Manual per-route audit emission — no structural guard (3rd occurrence)

- **Title:** Escalated per the Law #11 aggregation rule — the same recommendation ("audit emission
  is a manual per-call-site convention; add a structural guard or accept the risk explicitly") has
  now surfaced in THREE contexts: PLAT-EPIC-003 PR review (settings route omission — happened),
  PLAT-TASK-009 QA (kept manual during the emitter hardening, risk explicitly deferred "do not
  defer this again without a decision"), and CE-TASK-001 QA (CE-WRITE-1, the platform's most
  consequential mutation surface, shipped with zero audit emission — the predicted "6th mutation
  route" failure mode, materialized).
- **Root cause:** emission is a per-route convention with no enforcement seam. Every new mutation
  route starts audit-silent by default and stays that way unless the engineer remembers.
- **Severity:** Project · **Raised in:** PLAT-EPIC-003 review, PLAT-TASK-009 QA, CE-TASK-001 QA.
- **Owner:** Architect — decide between (a) a startup-time structural check in the pattern of
  `rbac.assert_all_routes_guarded` verifying every state-mutating route emits, (b) middleware/
  dependency-injected emission, or (c) an explicit tech-spec acceptance of the manual-call-site
  risk. The immediate CE-TASK-001 instance is being fixed in the task retry; this issue is about
  the structural guard so a 7th route can't repeat it.
- **Deadline:** Before CE-TASK-003 (next contract-surface task) starts.

## PROJ-008: elicit skill SKILL.md has a broken path template (harness bug — governance path)

- **Title:** `.claude/skills/elicit/SKILL.md` lines ~44/105/120 concatenate a directory onto a file
  path with no separator: `docs/specs/weave/engines/<entity>.md00-elicit/` (missing `/` between
  `.md` and `00-elicit`, and `.md` should not precede a directory segment at all). Any agent
  following the template writes elicitation output to a garbage path.
- **Severity:** Project (harness) · **Raised in:** M2/v1 red-team coordinator log (2026-07-08),
  re-verified 2026-07-08 WS1-GAP pass.
- **Owner:** Harness maintainer — this is a `.claude/skills/**` file, so the fix requires an
  advisor consult + `Advisor-Consult:` trailer per harness-governance; do NOT fix inline mid-task.
- **Deadline:** Next harness PR / phase-gate remediation sweep.

## PROJ-009: Cross-engine conformance tests promised but untracked (3 items)

- **Title:** Three conformance checks were ruled necessary in the M2/v1 coordinator pass but exist
  only as decision-log checkboxes, not as any brief's AC or a tracked test: (a) JWT
  `principal_iri` claim conformance test — a Cognito config change must not silently break GE
  attribution (partial ACs exist in CE v1 TASK-023, ex-GE v1 TASK-004, but no platform-side contract test); (b)
  CE-WRITE-1 idempotency-key contract test — Platform v1 TASK-018 AC-6 depends on the pinned
  semantics (per-tenant key, 24h window, replay→201, diff→409) but CE has no test proving it
  serves them; (c) `ge-canvas-1.md` prop-surface freeze confirmation — frontmatter still
  `confirmed_by: none` despite the stability rule being load-bearing for Build M2.
- **Severity:** Project · **Raised in:** m2-v1-spec-decisions.md follow-ups, WS1-GAP verification
  (2026-07-08).
- **Owner:** (a) Platform architect — add contract-test AC to the identity/JWT surface task;
  (b) CE architect — add idempotency contract-test AC to the CE-WRITE-1 owning task; (c) GE — set
  `confirmed_by`/`confirmed_on` in ge-canvas-1.md frontmatter at next GE spec touch.
- **Deadline:** Before the merged-milestone spec-review gate (WS1 step 4 / /spec-review).

## PROJ-010: Stale pre-merge spec paths in docs/standards (harness-governed)

- **Title:** `docs/standards/testing-ts.md` (lines ~224, 225, 231, 248, 273, 324) and
  `docs/standards/design/data-viz.md` (line ~223) still cite the pre-2026-06-30 split-spec path
  `docs/specs/graph-explorer/02-prd/prd.md`. That layout was removed by the spec merge
  (2026-06-30); the content now lives in `docs/specs/weave/engines/constitution-engine.md` §5–§8
  (Graph Explorer sections, merged 2026-07-08). The perf thresholds referenced are otherwise
  unchanged — this is a citation-path fix only.
- **Severity:** Project (documentation drift; standards cite dead paths).
- **Raised in:** CE+GE merge verification sweep (task #13, 2026-07-09). Pre-existing — NOT caused
  by the merge.
- **Owner:** Harness maintainer — `docs/standards/**` is harness-governed, so the fix needs an
  advisor consult + `Advisor-Consult:` trailer; do NOT fix inline mid-task.
- **Deadline:** Next harness PR / phase-gate remediation sweep.

## PROJ-011: CLAUDE.md "no application code yet" premise is stale (harness-governed)

- **What:** Root `CLAUDE.md` still says the repo is "a spec-driven dark-factory harness — there is
  no application code yet." `packages/{backend,frontend,shared}` is a real running PoC (FastAPI +
  Next.js) with 31 tasks done. The stale premise caused a brief-authoring agent to invent a
  `design-system/` path instead of grounding against the live `packages/frontend/components/`
  tree (caught and fixed in the same pass, weave-platform TASK-026/027).
- **Raised in:** WS1 step-4 architect pass (task #16, 2026-07-09), by the platform brief author.
- **Owner:** Harness maintainer — `CLAUDE.md` is harness-governed, so the fix needs an advisor
  consult + `Advisor-Consult:` trailer; do NOT fix inline mid-task.
- **Deadline:** Next harness PR / phase-gate remediation sweep (bundle with PROJ-010).

## PROJ-012: Audit hash-chain "Chain broken" observed once, unreproducible (monitor)

- **What:** During WS3 M1-gate e2e runs (2026-07-09), audit-logs.spec.ts once failed with backend
  verify result "Chain broken — 0 entries checked, first broken seq 1". Not reproduced across
  3 isolated + 5 full-suite runs on cleanly reset stacks. Code reading ruled out the cheap
  explanations: empty table verifies valid (audit/chain.py:127-146), genesis written once under
  `if created:` (db/seed_demo.py:150-159), signing key stable across process restarts
  (audit/signing_key.py), no spec truncates audit tables, workers=1 so no parallel writes.
  Occurrence coincided with a stale pre-reset environment + auth rate-limit starvation churn.
- **Why it matters:** chain integrity is the product's core trust mechanic (PLAT-TASK-009); even
  a spurious "broken" verdict erodes it. The UI badge collapses three distinct error codes
  (hash_mismatch / chain_broken / signature_invalid) into one string, so the one sighting is
  undiagnosable after the fact.
- **Follow-up:** on next occurrence capture the raw `POST /api/audit/verify` response `error`
  field (network log), not the badge text. Consider a debug log line in verify_entries naming
  the failing check + seq. Candidate small task for the audit-surfaces epic (PLAT-V1-EPIC-009).
- **Raised in:** WS3 M1 gate close-out (2026-07-09). **Owner:** unassigned (monitor).
- **Deadline:** none (monitor); instrument if seen again.

## PROJ-013: `pytest-cov` + `asyncpg` segfaults the docker-marked integration lane (recurring, escalated)

- **What:** Running the `@pytest.mark.docker` integration lane under `pytest-cov` (either the
  default C tracer or `COVERAGE_CORE=sysmon`) segfaults (exit 139) inside the DB-connection
  fixture setup on this environment. Reproducible on demand, not test-code-specific — same
  symptom on two independent tasks' docker-marked suites.
- **Raised in:** BE-TASK-001 (M1 Project Bootstrap Stub, 2026-07) — logged as a cross-task finding
  but never written to `qa-cross-task-findings.md`. **Raised again in:** BE-V1-TASK-001 (Standards
  Catalogue QA pass, 2026-07-10) — same command, same exit 139, on
  `tests/integration/test_standards_api.py`. Per aggregation rule (QA Law #11), escalating here
  instead of repeating a third time in a per-task report. **Raised a third time:** BE-V1-TASK-005
  (SDK-generation delivery, 2026-07-11) — narrowed further: the crash is not fixture-specific, it is
  ANY `asyncpg` connect reaching `connect_utils._create_ssl_connection` under an active `--cov`
  tracer (reproduced via both `db/migrate.py::run_migrations` and `db/pool.py::get_app_pool` from
  plain `tests/unit`, so not integration- or session-fixture-only). Same workaround.
- **Consequence:** DB/HTTP-path statements in repo-layer files (`standards/store.py` 57%,
  `standards/ce_client.py` 31% measured unit-only) can only be coverage-measured from the unit
  lane's mocked/fake-connection tests; the docker lane proves correctness (all green) but cannot
  currently contribute to the coverage percentage. Both tasks worked around it by reporting
  coverage from the unit lane alone plus a `--cov`-free docker-lane pass for correctness.
- **Owner:** Engineer (or Scaffold-phase, if it's a pinned-version mismatch) — bisect whether it's
  `pytest-cov`, `coverage.py`, or `asyncpg`'s C extension, and either pin a working version
  combination or document a permanent `--no-cov` carve-out for `@pytest.mark.docker` in
  `docs/standards/testing-py.md`.
- **Deadline:** before the next milestone's phase-gate remediation sweep (bundle with PROJ-010/011).

## PROJ-014 — test_runs_api::test_one_pdac_cycle_commits_state_spine_dispatch_count_1 intermittent flake

- **Severity:** Low · **Status:** OPEN (watch). Fails intermittently even in isolation (docker lane), no bindings/feature code path involved. First traced 2026-07-10 (BE-V1-TASK-022 AC-3 retry). Pre-existing sandbox flake, not a regression. Phase-gate: reproduce + root-cause the PDAC dispatch-count assertion.

## PROJ-002: no locust perf infrastructure exists repo-wide — blocks M2 perf DoD (escalated 2026-07-11, 2nd occurrence)
`m2-delta.md` §9 pins p95 targets (cold ≤500ms / cached ≤100ms @100k) for 5 M2 endpoints — `/api/events`, `/api/functions`,
`/api/functions/{iri}`, `/api/brand/*`, `/api/metrics/ontology` — "measured like §1" (the CI-gated ce-perf lane). But NO
locust harness exists anywhere (`testing-strategy.md` §6 mandates a `performance` workflow + names only 4 OLD endpoints;
the 5 M2 ones were never added → spec drift between §6 and §9). Each M2 task's brief DoD says "unit+integration+perf" →
every such task FAILs QA on the perf half with nothing to run.
**affects:** CE-V1-TASK-003 (brand, perf benchmark being built bespoke acb3de7), CE-V1-TASK-007 (metrics, FAIL this pass),
CE-V1-TASK-008 (events), CE-V1-TASK-009 (functions, in-flight), CE-V1-TASK-010.
**DECISION NEEDED (gates the CE M2 backend wave):** (a) build ONE shared locust harness (the `ce-perf` CI lane's missing
locust file) covering all 5 M2 endpoints + reconcile §6↔§9 — CE-003's in-flight brand benchmark is the natural seed; OR
(b) explicitly descope M2 per-endpoint p95 gating to a dedicated perf task/ADR + record it (unblocks all 5 DoDs now,
perf verified later). Until decided, these tasks are done-except-perf.

### PROJ-002 UPDATE (2026-07-11): DOWNGRADED — not a systemic block.
CE-003 proved the perf half is satisfiable per-task via the EXISTING ADR-004 in-process p95-benchmark pattern
(`scripts/benchmarks/ce-perf/run_benchmark.py`), NOT literal locust. Real 100k p95 = 4-5ms for brand endpoints. So
"locust" in the briefs = loose wording for "p95 perf benchmark", satisfied by the ADR-004 pattern. Each M2 task delivers
its own `run_<x>_benchmark.py` extending the pattern (CE-003 done; CE-007 retrying same way). **Residual (architect, non-blocking):**
reconcile testing-strategy §6 (names only 4 old endpoints, implies CI-locust) vs m2-delta §9 (5 M2 endpoints "measured like §1")
— decide whether a CI-gated perf lane is also wanted, or the in-process dev benchmark is the accepted gate. NOT blocking task DoDs.

## PROJ-003: integration/e2e tests SILENTLY DESELECTED without the marker (2026-07-11)
`packages/backend/pyproject.toml` addopts deselects `integration`/`e2e`-marked tests by DEFAULT — even when a test file
path is named explicitly. Correct invocation (matches CI `ci.yml`) = `pytest -m "integration and docker and not stack" <path>`.
Found by PLAT-013: its 7 refine integration tests had NEVER actually run in prior engineer passes ("backend tests pass"
claims were unit-only) — and hid 2 real test-file bugs (wrong principal-iri format → 403, bad restore assertion).
**Impact:** any engineer/QA who ran `pytest <path>` WITHOUT the marker got a false green (0 integration tests ran).
QA subagents are instructed to use the marker (safe). **Mitigation:** all future engineer/QA briefs must run docker-integration
with `-m "integration and docker and not stack"`; consider a CI/pyproject guard that errors if a named integration file
collects 0 tests. Non-blocking but corrupts confidence — audit prior task integration claims at phase gate.

## PROJ-004: frontend E2E specs mock BOTH read+write routes → no backend-state assertion (Law B gap) — 2026-07-11
Many Playwright specs (glossary.spec.ts, ce-query.spec.ts, ce-authoring.spec.ts, + 8 more) `page.route`-mock both the read
(`/api/proxy/sparql`) AND write (`/api/operations/apply`) routes → a green E2E proves UI WIRING only, not persistence (Law B
wants a backend-state assertion). Mitigated per-task by backend integration tests hitting the real apply→readback path, but
the E2E layer itself asserts nothing real. **Follow-up (phase-gate):** add ≥1 un-mocked Playwright spec per UI epic that
creates via real dev stack + reads back via real SPARQL. Cross-task (repo-wide), non-blocking. Also relevant to XT-PLAT010-2.

## PROJ-005: main RED — EPIC-008 (#54) merged with failing CI (2026-07-11, CRITICAL)
EPIC-008 was merged (user, held-PR) WITHOUT green CI → `ba818b9` (main) is RED on api/integration/mutation-strict/semgrep.
Root cause: EPIC-008's SDK-gen tests (`test_sdkgen_pipeline.py`, `test_sdkgen_emit_typescript.py`, `test_sdkgen_pipeline_unit.py`)
shell out to the frontend `tsc` binary, but the backend CI jobs never install frontend deps → `FileNotFoundError:
packages/frontend/node_modules/.bin/tsc`; PLUS a cwd-relative path bug (`backend/frontend/...tsc` under mutmut). Also 2
blocking semgrep findings on main. **Blocks EVERY epic merge** (PR #55 inherits it). Fix in-flight on `fix/ci-green-main`
(af666d8): robust repo-root tsc-path + install frontend tsc in api/integration/mutation jobs + triage the 2 semgrep findings —
gates made to RUN+PASS, NOT disabled. LESSON: never merge an epic PR (esp held/migration) before its CI is green; EPIC-008
#54 should have had CI verified pre-merge.

## XT-CE002-1: create-glossary-term false-succeeds on 201-with-missing-ref_map (2026-07-11, FIXING)
Reviewer (PR #55): `lib/glossary/create-glossary-term.ts` returns {type:ok, iri:""} when a 201 response's ref_map lacks the
minted IRI → term "created" with empty IRI. Blocker, false-success (subtler CE-013 class — QA checked status-gating, missed
the ref_map extraction). Fix in-flight: guard missing ref → return error. Status: FIXING.

## PROJ-007: subagent tool-results polluted with stale cross-worktree replay (2026-07-11, tooling)
MULTIPLE engineer/QA subagents reported their Bash/tool results repeatedly followed by a large injected "proactive
expansion" block replaying STALE, irrelevant frontend-lint/command output from OTHER worktrees (EPIC-009/010/004). No
legitimate instructions in it; agents correctly disregarded it + worked from real command output. Did not corrupt work
but wastes agent context + risks confusion. FLAG the injection/compression mechanism (headroom? proactive-expansion) for
a harness look — possible cross-session/worktree cache bleed. Non-blocking.

## PROJ-009 — Build E2E suite blocked by pre-existing RBAC/seed 403 (2026-07-11)
BE-020's Playwright E2E (and the unmodified `project-settings.spec.ts`) fail at the shared login/setup step: the
project-creating admin gets **403 Forbidden** saving source-control config. Reproduced on a FRESH migrated+seeded stack
(`weave-be020e2e`), so NOT stack-pollution — a genuine RBAC/seed-drift bug in shared Build test infra. **Blocks real
Playwright E2E across Build UI tasks** (BE-017 kanban, BE-019 dashboard will likely hit the same) → those tasks fall back to
E2E-met-by-inference (backend integration proves real state). Needs a dedicated fix (shared RBAC/seed — likely a role grant
missing in the seed, or a role-slug drift). Under QA verification (BE-020 QA a3e648c). If confirmed, HIGH priority — it gates
the phase's Law-B E2E for the whole Build engine. Surfaced to morning HITL.

### PROJ-009 CONFIRMED root cause (BE-020 QA a3e648c, 2026-07-11)
Traced: `routers/projects.py::create_project_route` never inserts a `pm.contributors` row for the creator, AND mock-oidc's
`admin@weave.local` seed carries no project-scoped grant. `PUT /source-control` requires `require_project_role(SETTINGS)` =
`has_admin_grant(roles)` OR a contributors row → a freshly created project's OWN creator gets **403** configuring its
source-control. This is NOT just a test-infra issue — it's a real RBAC/product defect (a project creator can't configure
their own project) from EPIC-002/TASK-011/023, untouched by BE-020. Blocks any Build E2E whose setup does source-control
config (NOT general login — BE-019's dashboard E2E passed fine). Fix options: (a) grant creator a contributor/owner row on
project creation, or (b) seed admin a tenant-wide grant that covers SETTINGS. HIGH priority — surface to user (real RBAC gap
+ gates part of Build E2E). Diff-verified BE-020 didn't touch rbac/contributors/mock_oidc/source_control/projects.

## PROJ-010 — project creation 503 `ce_version_unavailable` blocks Build E2E (2026-07-11)
BE-017 QA/build found: creating a project 503s with `ce_version_unavailable` (GET /api/ontology/versions returns no published
version) BEFORE any feature code runs. Reproduced on the unmodified `project-settings.spec.ts` (6/6 same fail). This is
UPSTREAM of PROJ-009 (which is the later source-control-config 403). Two shared-infra/seed gaps now block the Build E2E suite:
**PROJ-010 (no seeded published CE version → project create 503)** then **PROJ-009 (creator lacks contributor grant → 403 on
source-control)**. Consequence: NO Build UI task (BE-017/019/020) can currently get a real green Playwright E2E through the
full create→configure flow — all fall back to E2E-met-by-inference (backend integration proves real state). NOTE BE-019's
dashboard E2E DID pass — its flow seeds/needs no published CE version + no source-control step. Fix = the Build E2E harness
seed must publish a CE ontology version + grant the creating admin a project role (or these two flows must not require them).
HIGH priority — gates Law-B E2E for the Build engine at phase close. Surface to user with PROJ-009.

## PLAT-TOKEN-1 + XT-PLAT027-E2E (PLAT-027 QA follow-ups, non-blocking, 2026-07-11)
- **PLAT-TOKEN-1:** `components/shell/command-palette.tsx` (max-w-[560px]) + `avatar-menu.tsx` (max-w-[240px]) hard-code px
  widths; siblings use token-scale (max-w-xl/xs). `components/shell/**` is structurally exempt from weave/token-conformance
  (pre-existing TASK-026 carve-out). Narrow (width only). → design-debt sweep.
- **XT-PLAT027-E2E:** bell-panel-day-grouping.spec.ts mocks the notifications API wholesale → Law-B gap (asserts mocked POST,
  not real backend read:true). → add a real GET /api/notifications assertion at phase-gate (PLAT-NOTIFY-1 backend test = TASK-007).
- PLAT-027 finding #1 (section-rail SSR/hydration mismatch) is being FIXED before EPIC-011 merge (not deferred).

## XT-PLAT027-ROLE — client role-name drift (M1 "admin" vs spec "workspace_admin") (2026-07-11)
#63 review (🟡 minor, non-blocking): `components/shell/section-rail.tsx` role-gates on M1 `role === "admin"`, but AC-6's
`can-suppress.ts` checks spec vocab `["workspace_admin","compliance_officer"]`. Under M1's actual "admin" role the CLIENT-SIDE
AC-6 non-suppressibility guard (audit.chain.invalid can't be muted) won't fire → a mute control could render it shouldn't.
**Backend PUT endpoint is the real control** (client gate = UX/defence-in-depth, not the security boundary); QA passed AC-6 on
spec-role tests; code comment acknowledges the gap (fixes when M1 adopts spec role vocab / PLAT-SETTINGS-1). Part of the broader
**role-slug harmonization** (already in the morning-HITL batch + relates to PROJ-009 RBAC). Merged #63 non-blocking; harmonize
at phase-gate.

## PROJ-011 — TS 5.9 removed moduleResolution=node10 -> sdkgen tsc red across ALL branches (2026-07-11)
CI api/mutation jobs globally provision `typescript@5`, now resolving TS **5.9.x**, which REMOVED the `moduleResolution:
"node10"` option. The sdkgen template still emits `node10` -> sdkgen tests that shell out to `tsc --noEmit` fail (TS5108) on
EVERY PR: `test_sdkgen_emit_typescript::test_emitted_typescript_passes_tsc_noemit` +
`test_sdkgen_pipeline_unit::...five_ce_fetches...`. Pure external toolchain drift (like the #56 red-main saga), NOT any
feature's fault. Blocks CI on #64 + every open/future lane PR. Fix in flight = main hotfix `fix/sdkgen-tsc-moduleresolution`
(aa8463c): update the sdkgen tsconfig template moduleResolution -> bundler/node16 (or pin TS 5.8). Once merged -> rebase #64 +
all lanes onto fixed main. RESOLVED-PENDING-MERGE.

## EPIC-003 #64 — review-CLEAR + HELD (migrations 0065/0067); CI-red is PROJ-011 only (2026-07-11)
cavecrew review CLEAR (migrations forward-only/RLS, AC-2 reader-403+audit, AC-5 no-2nd-cost-path, __init__ router union clean,
SQL parameterized). api/mutation red = PROJ-011 (sdkgen TS drift, not EPIC-003 code); web/integration/semgrep/secrets pass.
-> HELD for human merge after the PROJ-011 hotfix lands + #64 rebases onto green main.

## PROJ-011 RETRACTED (2026-07-11) — was a local-env misdiagnosis
The `moduleResolution=node10 removed` TS5108 fires only under **TypeScript 7** (the coordinator's local nvm `tsc` = 7.0.2).
CI pins `typescript@5` (=5.9.3) which accepts the sdkgen template's `moduleResolution: "node"` fine — both sdkgen tsc tests
PASS in CI. My local `WEAVE_TSC_BIN=tsc` repro used the machine's TS7 → false alarm. **No sdkgen CI break.** Low-pri follow-up
(non-urgent): move the sdkgen tsconfig template to `"bundler"`/`"node16"` before CI ever bumps to a TS7-era pin (node resolution
is gone there) + update the golden fixture — logged as **PROJ-012** below.

## PROJ-012 (low-pri) — sdkgen TS template will break under TS7
`sdkgen/templates/typescript/tsconfig.json.j2` uses `moduleResolution: "node"`, removed in TS7. Not breaking today (CI pins TS5).
Proactive fix before any TS7 bump: template → `"bundler"`/`"node16"` + matching `module` + update golden fixture test. Phase-gate/backlog.

## XT-BE021-TESTSEAM (REAL #64 blocker, 2026-07-11) — unit test hits LocalStack unmocked
#64 api + mutation(a/b) all red on ONE test: `tests/unit/test_prompts_router.py::test_synthesise_typed_brief_from_prompt_before_delegate`
→ `botocore EndpointConnectionError: http://localhost:4566/`. `_synthesise_prompt_briefs` persists the brief to S3; the unit test
stubs synthesise_briefs_fn but NOT the S3 write → in the non-docker `api` job (no LocalStack) it makes a real boto call → fail.
Passed in QA's docker env (LocalStack up) — a test-isolation defect QA missed. Fix: inject/mmock the S3 seam so the unit test
runs without LocalStack (or mark it docker). BE-021 test bug, on feature/BE-V1-EPIC-003. Fix in flight → rides #64.

## XT-BE021-TESTSEAM RESOLVED (2026-07-11, commit 9ce2ebd8)
Root: _synthesise_prompt_briefs -> run_dor_gate -> audit emit -> get_signing_key (real secretsmanager boto to LocalStack:4566). Patched get_signing_key in 2 unit tests (test_synthesise_typed_brief + test_hold_prompt_run). Sibling-proofed the WHOLE unit suite hermetic via a POISONED endpoint (LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1) — all boto clients honour that env var; full pytest -m "not docker and not e2e" green against it. Pushed to feature/BE-V1-EPIC-003 -> #64 re-CI. **Lesson: unit tests that trigger the audit/gate path make a real secretsmanager call; mock get_signing_key. Poisoned-endpoint env var is the hermeticity proof.**

## PROJ-014 — unit tests hitting the network pass in docker-up envs but red in CI api job (2026-07-11)
RECURRING: a test marked UNIT (not docker/e2e) makes a real network call (oxigraph httpx, LocalStack/secretsmanager boto,
audit get_signing_key). It PASSES in QA's docker env or any local run left with WEAVE_KEEP_STACK=1 docker up, but the CI api
job runs pytest -m "not docker and not e2e" with NO services then ConnectError then api + mutation red. Hit: XT-BE021-TESTSEAM
(get_signing_key boto, #64), test_governance_shapes::test_commit_tenant_shape (oxigraph httpx, #65). Mitigation (standing
policy): every reconcile-verify + QA MUST run pytest -m "not docker and not e2e" with endpoints POISONED
(LOCALSTACK_ENDPOINT_URL/OXIGRAPH_URL=http://127.0.0.1:1) or docker fully DOWN, never trust a run with a live stack. Unit tests
needing a service must mock the client or be marked docker. Phase-gate: audit tests/unit for unmocked network seams.

## PROJ-COV-SEGFAULT — coverage.py + asyncpg C-extension segfault (backend --cov)
- **Raised:** 2026-07-14 (ONB-TASK-005 QA; 2nd occurrence — TASK-004 hit it first → Law 11 escalation to project level).
- **Symptom:** `pytest --cov` segfaults during `platform_stack` fixture setup after the asyncpg C-extension loads (coverage.py sysmon core interaction). Reproduced independently, not a fabricated excuse.
- **Effect:** backend numeric coverage % cannot be obtained in-worktree; QA falls back to branch-by-inspection (WARN-grade, not PASS-grade).
- **Owner:** Engineer/harness. **Fix candidates:** pin coverage.py off sysmon core (`COVERAGE_CORE=ctrace`), or exclude the C-ext path, or run coverage without the docker fixture. Phase-gate item.

## PROJ-A11Y-EXPLORER (2026-07-15, surfaced by CE-030 M2 a11y gate) — OPEN
The M2 UI a11y gates CE-030 wired (axe-m2 + lighthouse-explorer) are now live and RED on the Explorer route: Lighthouse accessibility score < 0.95 (perf is warn-only), and axe likely reports real violations on the M2 Explorer panels. This is PRE-EXISTING debt in the Explorer panel code (CE-V1-TASK-020/021/022, merged), not CE-030 (test-only gate). ACTION (phase-gate remediation / owning-task): fix Explorer panel a11y to clear Lighthouse a11y ≥0.95 + zero axe violations, or calibrate thresholds with an architect amendment. Blocks CE-030 (#106) from a fully-green merge until resolved.

## PROJ-FLAKY-BILLING-PERF (2026-07-15) — OPEN
`test_billing.py::test_simulate_ai_call_under_cap_calls_ai_client_and_records_usage` asserts a WALL-CLOCK budget `elapsed_ms < 100` (metering write); flaked at 226.7ms on a loaded CI runner (#110 integration job, unrelated PR). Wall-clock perf assertions in integration tests flake under CI contention. FIX (owning task PLAT-TASK-008/billing): assert a server-reported op duration or give CI headroom, per the ONB-015 reset-test precedent (server duration, not browser wall-clock). Phase-gate remediation candidate.
