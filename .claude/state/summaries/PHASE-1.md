---
title: "Phase Gate: weave-platform Phase 1"
status: Approved
phase: weave-platform/phase-1
date: 2026-07-05
security_verdict: PASS
mutation_score: 64.5%
---

# Phase Gate: weave-platform Phase 1

## Gate Criteria

**Phase:** weave-platform/phase-1 — Platform shell (8 tasks, 7 epics)
**Triggered:** All 8 phase tasks at done status (progress.sh phase-check COMPLETE)
**Approver:** Human (HITL)

## Checklist

### Deliverables

- [x] All stories in phase marked Done — 8/8 tasks (PLAT-TASK-001..005, 007, 008, 009), 7/7 epics
- [x] All tests passing — final state: backend fast lane 202, docker lane 53 (audit 8/8, billing 8/8 subsets re-verified), frontend vitest 79, Playwright e2e 13; PR #19 CI fully green (api, integration, mutation, web, semgrep, secrets)
- [x] Test coverage ≥ 80% — per-module at each task close: notifications 82%, billing 97%, audit 97% (signing_key.py 100%)

### Quality

- [x] No lint errors — ruff, mypy (143 files), eslint, tsc all clean at final commit ec09fc8
- [x] Complexity within thresholds — Law E verified per task by QA; no waivers needed (two over-300-line test files follow pre-existing repo pattern)
- [x] QA review complete for all stories — independent QA pass per task; PLAT-TASK-008 FAILed once (ungated simulate endpoint calling real AI provider — fixed 3f081dc, re-validated), 14 QA edge-case tests added across the 3 new epics (incl. IDOR probes, chain reordering, TRUNCATE boundary)
- [x] No unresolved failure reports — zero open escalations; all QA verdicts final PASS/RESOLVED
- [ ] **Mutation score ≥ 70% — RED.** Per-PR tier (real, CI-measured on final commit): **64.5%** against its structural floor of 60 (unit-lane-only; SQL/boto3 mutants can only die under live services — PROJ-005). The strict-70 tier (live services + integration suite) was attempted locally 3× at this gate and could not complete: a second Claude session (fix-mutation-ci-db worktree) shares the docker compose namespace and recreated/tore down the containers mid-run twice (evidence: `role "weave_app" does not exist` mid-suite after clean migration; containers "Up 21 seconds" mid-collection). The deterministic strict-70 job runs BLOCKING on every main push and will execute when this stack merges. No fabricated score: the only verified number is 64.5% per-PR-lane.

### Artifacts

- [x] PRs created and reviewable — stacked per Law D: #17 notifications (base main) ← #18 billing ← #19 audit; every PR review-gated (5-reviewer protocol + confidence scoring); 5 review findings fixed in-branch (transaction-unwind guard, signing-key TOCTOU, event-loop lock, blocking SDK call, task-GC refs), 1 posted to PR #19
- [x] Commits follow conventional format — verified across the 37-commit stack (one known label mismatch: 0798607 `test:` carries impl too, engineer-disclosed, cosmetic)
- [ ] Documentation updated — **docs/api.md and docs/architecture.md do not exist yet** (phase-gate docs generation not yet run); ADR-001..010 current; README.md exists (pre-phase)

### Environment

- [x] App runs locally — full stack booted 4× at this gate (docker compose + migrate ×5 migrations + uvicorn + mock-oidc + production Next.js build)
- [x] Test suite runs — `uv run pytest` / `npm test` verified repeatedly through the gate
- [x] Build succeeds — production `next build` served for every ui_verify run
- [x] UI gate re-executed at gate time (not cached): `ui_verify.sh --full` on final ec09fc8 → **PASS** (structural+a11y, 13-test Playwright click-through, 8-state visual, Lighthouse 100×4 desktop preset on production build)

## Open ledger items surviving to gate (nothing rots silently)

| Item | Severity | Age | Owner |
|---|---|---|---|
| PROJ-006: two consecutive features (billing, compliance) ship Playwright e2e that fully mock the network — no real-backend browser proof (Law B gap) | Project | this phase | QA-recommended: retrofit compliance.spec.ts as template |
| mock_oidc ships inside prod package with token-minting entry point | Blocker-before-deploy | 3 epics | Engineer, first-deploy checklist |
| Rate-limiter: spoofable x-forwarded-for key, shared "unknown" bucket login-DoS, no eviction (env-knob workaround in place for harness) | Warn | 3 epics | productionisation |
| lighthouserc.json methodology not pinned (desktop-preset + prod-build convention held manually) | Warn | 4 tasks | Architect |
| enforce_budget check-then-act race (spec-embedded; inert until real AI calls) | Warn (design) | this phase | Architect, v1.0 |
| Slack-retry pool-conn hold + audit advisory-lock latency compounding (inert with M1 stub) | Warn | this phase | Architect, PLAT-CONNECTOR-1 |
| verify_chain O(chain length) per compliance hit | Warn (scaling) | this phase | Architect, v1.0 |
| PLAT-TASK-002 type-scale token taxonomy gap in globals.css | Warn | 5 tasks | PLAT-TASK-002 owner |

## Cost Summary

| Metric | Estimated | Actual |
|--------|-----------|--------|
| Total tokens (input) | ~110K (3 briefs) | N/A (not instrumented) |
| Total tokens (output) | ~55K (3 briefs) | N/A (not instrumented) |
| Total cost | ~$7 (3 briefs) | N/A (not instrumented) |
| Variance | — | — |

## Decision

- [x] **Approve** -- proceed to next phase
- [ ] **Amend** -- address specific items before proceeding
- [ ] **Reject** -- significant rework needed

## Notes

Approved 2026-07-05 (HITL, engine-boundary sign-off). Accepted with tracked debt: mutation
64.5% per-PR lane (strict-70 backstop runs blocking on main-push post-merge); PROJ-006
real-backend e2e retrofit; docs/api.md + docs/architecture.md generation. Open ledger table
above carries forward — nothing closed silently.

**Post-merge verification (2026-07-05):** PRs #17/#18/#19 merged to main by the human; the
blocking `mutation-strict` job ran on the merge push (run 28725517537) and scored
**77.3% against the 70% threshold — PASS**. The gate-time RED (64.5%, per-PR unit lane,
structurally capped per PROJ-005) is closed: the deferred full-suite measurement exists and
clears the bar. Checklist mutation row considered satisfied as of this run.

---
*HITL gate template. This file is created per phase and reviewed by the human approver.*
