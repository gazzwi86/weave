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
  `tests/integration/test_standards_api.py`. **Raised a third time in:** CE-V1-TASK-012 (ingest
  pipeline docker-integration tests, 2026-07-10/11) — same command, same exit 139, on
  `tests/integration/test_ingest_pipeline.py`; reproduced both standalone and with `--cov-append`
  onto existing unit-lane coverage data, so it's not an append-order artifact either. Per
  aggregation rule (QA Law #11), escalating here instead of repeating a fourth time in a per-task
  report.
- **Consequence:** DB/HTTP-path statements in repo-layer files (`standards/store.py` 57%,
  `standards/ce_client.py` 31% measured unit-only) can only be coverage-measured from the unit
  lane's mocked/fake-connection tests; the docker lane proves correctness (all green) but cannot
  currently contribute to the coverage percentage. All three tasks worked around it by reporting
  coverage from the unit lane alone plus a `--cov`-free docker-lane pass for correctness.
- **Owner:** Engineer (or Scaffold-phase, if it's a pinned-version mismatch) — bisect whether it's
  `pytest-cov`, `coverage.py`, or `asyncpg`'s C extension, and either pin a working version
  combination or document a permanent `--no-cov` carve-out for `@pytest.mark.docker` in
  `docs/standards/testing-py.md`.
- **Deadline:** before the next milestone's phase-gate remediation sweep (bundle with PROJ-010/011).

## PROJ-014 — test_runs_api::test_one_pdac_cycle_commits_state_spine_dispatch_count_1 intermittent flake

- **Severity:** Low · **Status:** OPEN (watch). Fails intermittently even in isolation (docker lane), no bindings/feature code path involved. First traced 2026-07-10 (BE-V1-TASK-022 AC-3 retry). Pre-existing sandbox flake, not a regression. Phase-gate: reproduce + root-cause the PDAC dispatch-count assertion.
