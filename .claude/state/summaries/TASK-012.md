# TASK-012 — Training Library & What's New

Status: done, HEAD `ff4beffb` on `feature/ONB-EPIC-006`.

## Decisions
- ADR-010: additive-only Zod schema extension (category, duration, video/walkthrough fields,
  what's-new version) on top of TASK-003's minimal config shape. No collision with ADR-001..009.
- No migration needed — pure frontend + shared-config task, no DB touch. Highest existing
  migration stayed at 0084; reserved block 0092-0093 untouched.
- `useWhatsNewUnread()` hook exported from `lib/onboarding/use-whats-new-unread.ts` for TASK-013's
  launcher badge to consume directly (per brief's implementation hint).
- Video error state falls back to the same placeholder card (never a broken `<video>` element) —
  matches ADR-006's posture.

## Edge cases covered
- Search is substring, case-insensitive, no index lib (brief's explicit instruction); perf-budget
  test asserts <300ms over 500 synthetic entries.
- Category groups with zero entries after filtering are hidden unless `availability !== "shipped"`
  (post-v1 categories always show their flag even when empty).
- What's-new empty feed renders `EmptyState` molecule, not a blank div.
- PATCH `/api/onboarding/state` validates body with Zod (`whats_new_seen_at` must be ISO datetime)
  before forwarding — Law 13.

## Local dev-environment notes (not committed)
- Worktree's `node_modules` under `packages/frontend`, `packages/shared`, and repo root were
  symlinks pointing outside the Turbopack root / filesystem root — broke Turbopack resolution.
  Replaced with real copies / in-boundary symlinks locally to run the dev server for E2E. Untracked,
  gitignored, no impact on the commit history.

## Gate results
- `tsc --noEmit`: clean (frontend + shared).
- `eslint`: 0 errors, 0 new warnings.
- `vitest`: 77 tests / 16 files (frontend onboarding-scoped) + 35 tests / 8 files (shared) — all
  green.
- Playwright E2E (`training-library.spec.ts`): 1/1 passed, includes zero-axe-violations assertion.
- Isolated docker stack (`weaveonb012`) spun up for the E2E run, torn down after (`down -v`),
  `.env` removed, verified no leftover containers/processes.

## QA pass (2026-07-14) — FAIL

- Re-ran independently in the worktree: `npx vitest run` 301 files / 1473 tests green (repo-wide);
  `tsc --noEmit` clean; `eslint` (onboarding scope) 0 errors; Playwright `training-library.spec.ts`
  ran as a real browser test (not skipped), 1/1 passed, zero axe violations, search + walkthrough
  interaction both exercised.
- AC-012-01, 02, 03, 04, 05: PASS — each has a named test, verified independently. AC-012-02 perf
  test uses 500 synthetic entries (well above M1's ~2 real entries), meaningful budget check.
  AC-012-04's PATCH round-trips through the pre-existing tenant+user-scoped `patch_state` store
  (RLS-scoped, TASK-001 infra) — real backend persistence, not client-only state.
- AC-012-06: **FAIL** — `app/help/training/page.tsx` hard-codes the page title, subtitle, and the
  "Mark What's new as read" button label as raw English strings (no `t()` / i18n key), and hard-codes
  `h-[8px] w-[8px]` for the unread dot where `var(--space-2)` already exists and is used one line
  above. axe-core returned zero violations (neither issue is an a11y rule) but Category 15's
  token/i18n conformance gate is separate and is a FAIL, not a WARN, per the design-system rule.
- Edge-case tests added (commit `e8fa8cd6` on `feature/ONB-EPIC-006`): PATCH `/api/onboarding/state`
  rejecting a malformed `whats_new_seen_at` and a missing body — the Zod validation guard (Law 13)
  had no test before this pass.
- Cross-task finding logged: `XT-ONB012-1` in `.claude/state/qa-cross-task-findings.md`, flags risk
  to ONB-TASK-013 (launcher) which renders a similar unread-dot pattern.
