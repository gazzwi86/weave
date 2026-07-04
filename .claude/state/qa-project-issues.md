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
- **Owner:** Engineer/QA — to lift the per-PR floor toward 70, add a **services-backed** mutation run
  (Testcontainers/LocalStack + Postgres) so SQL/AWS mutants can be killed, then raise
  `MUTATION_SCORE_THRESHOLD`. Until then the phase gate is the 70% enforcement point.
- **Deadline:** Before the platform phase gate (which blocks on the strict ≥70%).
