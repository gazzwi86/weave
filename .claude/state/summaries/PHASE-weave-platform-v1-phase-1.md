---
title: "Phase Gate: weave-platform-v1/phase-1 (TERMINAL program-v1 boundary)"
status: Approved
phase: weave-platform-v1/phase-1
date: 2026-07-15
security_verdict: PASS
mutation_score: ">=60% (CI mutation a+b green on main)"
---

## Governing principle
Terminal boundary of the program-v1 wave. A gate protects downstream from unresolved debt; verdicts
are evidence-based (CI on merged `main`), not optimistic. This is the last entry in `phase_plan`.

## Gate Criteria
| Field | Value |
|---|---|
| Phase | weave-platform-v1/phase-1 (last in phase_plan — program-v1 terminal) |
| Triggered | `progress.sh phase-check` = COMPLETE after connector descope |
| Approver | Human (HITL) |

## Deliverables
- All in-scope weave-platform-v1 tasks done and merged to `main`.
- **Scope change (this gate):** 8 managed connectors descoped v1 → post-v1 (PLAT-V1-TASK-006/018/
  019/020/021/022/023/025). Briefs moved to `weave-platform/post-v1/tasks/` (preserved, not
  deleted); spine retagged `engine=weave-platform-post-v1`. Per CLAUDE.md §Stack — connectors
  (Snowflake, Databricks, S3, Azure Data Lake, Atlassian, ServiceNow, Slack) deferred to v1.0.
- Commit `38793b89`.

## Quality signals (evidence: CI on merged main)
| Signal | Verdict | Evidence |
|---|---|---|
| Security (semgrep + secrets) | PASS | green on merged epic PRs |
| Mutation (mutmut a+b) | GREEN | both jobs pass on main |
| Lint / tsc / unit / integration | PASS | green on merged PRs |
| UI-verify (Playwright/Lighthouse/axe) | RED | sandbox no-Postgres (fail-closed, real-env deferred) + Explorer a11y debt PROJ-A11Y-EXPLORER |

Gate Law 6: UI-verify RED blocks a programmatic Approve. Human override (documented debt), identical
profile to the three boundaries already approved this session.

## Open debt carried forward (tracked, not blocking)
- `PROJ-A11Y-EXPLORER` — Explorer Lighthouse a11y <0.95 + axe fail.
- `PROJ-FLAKY-BILLING-PERF` — test_billing.py wall-clock flake.
- 4 M2 gate jobs live in ci.yml (fail-loud) but **not** registered as branch-protection required
  checks — user's repo-settings decision.
- Real-env ui-verify sweep (sandbox has no Postgres) — deferred to real environment.
- 8 connectors → post-v1 (this gate).

## Decision
- [x] Approve  — close program-v1 wave. Pointer stays terminal. Human override of UI-verify RED (documented debt). (2026-07-15)
- [ ] Amend
- [ ] Reject

## Notes
Terminal boundary — approving closes the program-v1 build wave. Remaining work (connectors, Explorer
a11y, real-env ui-verify) is tracked debt/post-v1, not blocking this gate.
