# ONB-V1-TASK-005 — M2 Overlay Release-Gate Suite

**Status:** done (PR #109, closes EPIC-002). Test-only, zero product code. Base 9ff0d06a.

## Delivered
- AC-005-06 invariants §M2 selector-check (backend test, 9/9): parses every §M2 verify-by clause, resolves against real tree (4 aspirational-layout drifts aliased honestly to real locations, not loosened), greps pattern.
- AC-005-07 shipped-gate (packages/shared vitest, 2/2): all 11 m2-delta §3 registry anchors shipped:true → green, no unshipped finding. ce.metrics-tile excluded (TASK-014 post-v1 descope).
- 22 E2E cases (m2-overlays.spec.ts) test.fixme (sandbox no-Postgres) — axe+focus-trap/surface, absent-anchor resilience over 11 anchors (CSS-toggle), role-tailoring, competency lifecycle, starter-tile.
- Always-run extras (stronger than fixme): role-tailoring matrix pure-function test (5/5); zero-CE-calls + idempotent self-mark backend test (2/2).
- Both CI checks run in EXISTING jobs — no new ci.yml job (avoided conflict with in-flight #106).

## Gates
backend 27/27, frontend 1672/1672, shared 94/94, tsc clean, lint 0 errors (both), audit-anchors 880 files.

## Known gap (reinforces existing follow-up, not new)
Competency self-mark `add_competency_questions` not in backend MANUAL_ONLY_MILESTONE_IDS → HTTP self-mark 404s (same gap TASK-003 flagged). Tests use record_milestone() directly. → competency-self-mark follow-up task (allowlist + route + widget map + phase).

## Coverage/mutation
Backend onboarding partial (recorder 100%, milestones 70%, router anomaly not chased); mutation not attempted (flagged, would need scoping). Note for phase-gate mutation sweep.
