# Spec review — graph-explorer

**Date:** 2026-07-02 · **Verdict:** PASS (after fixes) · **Reviewed by:** /spec-review (full-sweep)

| # | Finding | Resolution |
|---|---|---|
| 1 | 72 story ACs in Gherkin + a convention note licensing it (CRITICAL) | All rewritten EARS; note at ~L422 deleted; 0 `Given ` remain |
| 2 | architecture.md + testing-strategy.md missing (CRITICAL) | Both produced 2026-07-02 (module-in-SPA, renderer adapter, 10k perf budget, CE-READ-1-only access; Vitest-dominant pyramid + canvas E2E) |
| 3 | Systematic off-by-one relative links in both shards, ADR, all 5 briefs (HIGH) | Fixed and filesystem-verified |
| 4 | adr_refs empty on rendering tasks (HIGH) | TASK-002..005 → ADR-001-render-engine |
| 5 | AC-to-test drift (TASK-002, TASK-005) (MEDIUM) | Missing tests added to enumerated lists |
| 6 | FR-number drift in Deferred tables (MEDIUM) | saved-views→FR-028, comments→FR-024, GE-CANVAS-1→FR-034 |
| 7 | Stale "tech-spec not yet written" notes (MEDIUM) | Replaced with real ../../tech-spec refs |
| 8 | Telegraphic prose in Brief/§2 (WARN) | Rewritten readable, facts preserved |

Cross-engine timing: PASS. OQ-09 predicate-closure hand-off (CE→GE) added to M1 roadmap DoR; gates TASK-005 AC-6/7.

**2026-07-05 mtime-check:** specs touched after this review only by 99d623a (harness dedupe) — 7
reference-only lines (arch-skill renames/path fixes). No semantic change; verdict stands. Marker refreshed.
