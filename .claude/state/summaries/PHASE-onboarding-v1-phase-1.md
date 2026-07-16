---
title: "Phase Gate: onboarding-v1/phase-1 (batched program-v1 boundary)"
status: Approved
phase: onboarding-v1/phase-1
date: 2026-07-15
security_verdict: PASS
mutation_score: ">=60% (CI mutation a+b green on main)"
---

## Governing principle
A phase gate protects the next phase from inheriting unresolved debt. Verdicts are evidence-based
(CI on merged `main`), not optimistic.

## Gate Criteria
| Field | Value |
|---|---|
| Phase | onboarding-v1/phase-1 (batched program-v1 boundary) |
| Triggered | `progress.sh phase-check` = COMPLETE (all tasks done) |
| Approver | Human (HITL) — batch-approved 2026-07-15 alongside onboarding/phase-1 |

## Deliverables
- All onboarding-v1 tasks done and merged to `main` @ 1d644914.
- No non-done tasks belong to this engine; the only remaining program backlog is 8 PLAT connectors
  (weave-platform-v1, parked → v1.0, user-confirmed).

## Quality signals (evidence: CI on merged main)
| Signal | Verdict | Evidence |
|---|---|---|
| Security (semgrep + secrets) | PASS | green on merged epic PRs |
| Mutation (mutmut a+b) | GREEN | both jobs pass on main |
| Lint / tsc / unit / integration | PASS | green on merged PRs |
| UI-verify (Playwright/Lighthouse/axe) | RED | sandbox no-Postgres (fail-closed, real-env deferred) + Explorer a11y debt PROJ-A11Y-EXPLORER |

Gate Law 6: UI-verify RED blocks a programmatic Approve. Human override applied (documented debt),
identical to the onboarding/phase-1 decision.

## Decision
- [x] Approve — advance phase_plan (engine boundary). Human override of UI-verify RED; Explorer
  a11y tracked as PROJ-A11Y-EXPLORER; ui-verify deferred to real-env. (2026-07-15, batched)
- [ ] Amend
- [ ] Reject

## Notes
Batch-approved with onboarding/phase-1 — same CI-green / sandbox-RED evidence profile.
