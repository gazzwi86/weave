---
name: GitHub Actions CI restored 2026-07-10
description: CI is BACK (runners working) as of 2026-07-10 — the credits-outage waiver is LIFTED; run CI gates for real again
type: project
created: 2026-07-08
updated: 2026-07-10
---

**CI is RESTORED as of 2026-07-10** — GitHub Actions runners are working again (user-confirmed). The
2026-07-08→08-01 credits outage ended early. **The CI-down waiver is LIFTED.**

**How to apply now:**
- **Run CI gates for real** — CI-green gate (PLAN step 0), epic-close CI, `ui_verify --full`, mutation,
  the full pyramid all run in GitHub Actions again. Stop deferring them; stop applying the "local
  verification + waiver" substitution.
- **Epic PRs must go green in CI before merge / phase approval** (Step 3 CI-green gate, Step 4 verify).
- **Expect main CI to be red initially** — a lot of change landed under the outage (2 v1 epic PRs #48/#49
  + several parallel lane branches with docker-integration tests never run in CI, the `gates.py` 3-lane
  edits, etc.). User is merging #48/#49; main CI likely breaks post-merge and needs fixing. Feed failing
  CI job logs to an engineer, fix, re-push until green. Do NOT stack new work onto a red main.

**History (resolved):** 2026-07-08 credits exhausted mid-cycle → local-verification waiver used for M1
signoff (`PROGRAM-M1-SIGNOFF.md`) + all of build-engine-v1/phase-1's per-task gates. Those waivers were
documented substitutions, not weakened gates; they're now backstopped by the real CI run at merge.
