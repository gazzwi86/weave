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
