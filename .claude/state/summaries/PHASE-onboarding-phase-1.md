---
title: "Phase Gate: onboarding/phase-1 (batched program-v1 boundary)"
status: Approved
phase: onboarding/phase-1
date: 2026-07-15
security_verdict: PASS
mutation_score: ">=60% (CI mutation a+b green on main)"
---

## Governing principle

A phase gate protects the next phase from inheriting unresolved debt. If any quality signal is
red, the phase is paused, not ended. Verdicts below are evidence-based (CI on merged `main`), not
optimistic.

## Gate Criteria

| Field | Value |
|---|---|
| Phase | onboarding/phase-1 (5th of 8 in phase_plan; batched program-v1 boundary) |
| Triggered | `progress.sh phase-check` = COMPLETE (all onboarding tasks done) |
| Approver | Human (HITL) |

## Deliverables

- Onboarding phase COMPLETE: ONB-001..015 merged (PRs #105/#107/#108/#109/#110). EPIC-001 closed.
- Non-done program tasks are **not this phase**: 8 PLAT connectors (EPIC-002/006/007) parked → v1.0
  (user-confirmed); CE-V1-TASK-030 in_progress (#106 HELD OPEN on Explorer a11y — see UI-verify).
- main @ `c1fc56dc` (green apart from known-noise: ce-perf, mutation-strict, deploy-essential-dev).

## Quality signals (evidence from CI on merged main)

| Signal | Verdict | Evidence |
|---|---|---|
| Security (semgrep + secrets) | PASS | green on #105/#107/#108/#109/#110 |
| Mutation (mutmut a+b splits) | GREEN | both jobs pass 9–13m on #109/#110/#106 |
| Lint / tsc / unit / integration | PASS | web+shared+api+integration green on merged PRs |
| **UI-verify (Playwright E2E + Lighthouse/axe)** | **RED** | sandbox has no Postgres → webServer fails-closed (all browser E2E `test.fixme`, enforced real-env at epic-close); **Explorer Lighthouse a11y <0.95 + axe fail** (#106 held; logged `PROJ-A11Y-EXPLORER`) |

Gate Law 6: UI-verify RED blocks a programmatic Approve. Human may Amend (fix + re-gate) or accept
documented debt.

## Artifacts

- Open PR: #106 (CE-016 partial, M2 Release-Gate Suite) — held on the a11y RED, not merged.
- Conventional commits throughout; state committed `[skip ci]` to local main.
- Durable brief + 6 morning decisions: `.claude/state/overnight-queue.md`.

## Cost Summary

| Metric | Estimated | Actual |
|---|---|---|
| Total tokens | — | N/A (not instrumented) |
| Total cost | — | N/A |

## Decision

- [x] Approve  — advance phase_plan → `constitution-engine-v1/phase-1` (engine boundary). Human override of UI-verify RED; Explorer a11y tracked as PROJ-A11Y-EXPLORER, ui-verify deferred to real-env. (2026-07-15)
- [ ] Amend    — fix Explorer a11y (PROJ-A11Y-EXPLORER) + real-env ui-verify, then re-gate
- [ ] Reject   — replan

## Notes

_(human fills)_
