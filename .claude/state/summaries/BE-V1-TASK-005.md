# Progress: BE-V1-TASK-005 — BE-SDK-1 Trigger API + breaking-change Ack Flow + Provenance + Regeneration (EPIC-008, last task)

`build-engine` EPIC-008 (final task → epic COMPLETE). **PARALLEL LANE** worktree `../weave-EPIC-008`,
branch `feature/BE-V1-EPIC-008`. Backend·docker. **QA PASS after retry 1.** Built across a chaotic window
(a rogue parallel process split a file mid-DoD — reconciled, split kept as it's the cleaner Law-E solution).

## Outcome — QA PASS (retry 1), 2026-07-11

QA (task005-qa) FAILed round 1 on ONE narrow gap (QA-TASK-005-1, post-commit desync); engineer fixed it
(`e9580f0`); the strict-xfail proof test flipped to green (self-verifying). 14 passed (10 docker-integration
+ 4 unit), 0 xfail. All 8 ACs + both DoD invariants confirmed. retry=1/3.

## What shipped

- **Trigger/run/ack** (`sdk_trigger.py` 237 lines) + **commit machinery** split into `sdk_commit.py` (130).
  The split was done under the collision but is coherent + kept (satisfies Law E cleanly → **the earlier
  353-line file-length waiver is MOOT and was dropped**).
- **Migrations 0031** (drop too-narrow generation_runs status CHECK → open TEXT enum, gate_results pattern;
  + nullable run_kind/payload) **+ 0032** (widen run_id UUID→TEXT via safe cast + GRANT UPDATE). Both additive,
  ADR-022-documented. Persistence decision (widen generation_runs, breaking_hold reuses feature_dispatch_held
  HITL pattern) = user-approved MCQ.
- Provenance stamp + `{ce_version_tag}+build.{n}` (semver `+` metadata).

## Per-AC (all PASS)

AC-1 trigger 202 + 409-in-flight (SELECT…FOR UPDATE) ✓ · AC-2 breaking-span refusal reads CE-DIFF-1
verbatim (no re-derive) ✓ · AC-3 ack persists gate_results + resumes + D9 no-self-approval (mirrors
`approve_env_verification` M1 pattern) ✓ · AC-4 skip breaking-check on first gen ✓ · AC-5 atomic
stamp+commit+bookkeeping ✓ · AC-6 failure leaves repo+bookkeeping unchanged ✓ · AC-7 GET latest ✓ ·
AC-8 404 cross-tenant (RLS) ✓.

## DoD invariants (grep-confirmed)

- **Single `commit_workspace` call site** in SDK-gen flow: `sdk_commit.py:65` (`_commit_generated_sdk`),
  the single funnel both run_sdk_generation + approve_sdk_breaking_ack route through. (Other repo hits =
  unrelated app-gen/release flows.)
- **`sdk_breaking_ack` gate wired once:** fire once + record_gate once; release via one dispatch point
  (`build/hitl.py::_release_sdk_breaking_hold`, deferred-import to dodge circular import).

## QA-TASK-005-1 (the retry-1 fix)

`_generate_and_commit`'s fail-closed try/except originally wrapped only generate+commit; POST-commit
bookkeeping (update_project_sdk_generation/update_sdk_run_status) ran OUTSIDE it → if it threw after a
successful commit_workspace, the git commit landed but the run never marked failed + last_sdk_version_iri
never updated = desync ADR-006 §3 says can't happen. **Fix (`e9580f0`):** extend fail-closed handling to
cover post-commit bookkeeping; on failure mark run failed via FRESH connection + record commit_sha in
failure payload (orphaned commit discoverable). RESOLVED — XT/ledger updated.

## Known env issue (not this task)

PROJ-013: pytest-cov segfaults on asyncpg SSL-connect under coverage tracer → merged coverage number
unobtainable; unit-lane sdk_commit.py 88% / sdk_trigger.py 58% (uncovered = the DB-write paths the 10 green
docker-integration tests exercise but coverage can't instrument). Met-by-inference. Logged (pre-existing).

## PR / lane

Migrations 0031/0032 = **RISKY TIER → PR HELD for human morning review** (not auto-merged). EPIC-008 COMPLETE
(TASK-002/004/005/009 all done) → build-engine-v1/phase-1 phase likely complete → phase gate.
