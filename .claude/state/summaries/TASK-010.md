# TASK-010 — Onboarding Checklist Widget on the Dashboard

Status: implemented, tests green, committed to `feature/ONB-EPIC-005` (not
pushed). QA FAIL on AC-010-01 (path filter) fixed; XT-ONB010-1 anchor
follow-up folded in.

## What shipped

**Backend** (`packages/backend/src/weave_backend/`):
- `onboarding/store.py` — `sandbox_workspace_id`/`sandbox_forked_at` exposed
  on `OnboardingStateRecord`; `checklist_completed_at` added to `StatePatch`
  and its COALESCE upsert; new `clear_checklist_dismissal()` (restore is a
  plain `UPDATE ... SET checklist_dismissed_at = NULL`, no migration).
- `onboarding/milestones.py` — `MANUAL_ONLY_MILESTONE_IDS` allowlist
  (`{"invite_admin"}`).
- `routers/onboarding.py` — `checklist_auto_dismiss_days` resolved per
  request via the existing settings cascade (`resolve_setting`, company →
  domain → project, default 7); new routes `POST
  /api/onboarding/checklist/restore` and `POST
  /api/onboarding/milestones/{id}/self-mark` (404s anything not
  allowlisted).

**Shared** (`packages/shared/onboarding/`):
- `derive-checklist.ts` (new) — pure signal→completion derivation
  (`deriveChecklist`, `shouldAutoDismiss`), TDD'd, 17 unit tests.
- `content/checklist.ts` — 3 new items (`first-activation`,
  `invite-admin`, `connect-source`) with `signalRefs`/`lockedUntilPhase`/
  `badge` metadata; `content/schema.ts` extended to carry them plus a
  `Phase` type export.

**Frontend** (`packages/frontend/`):
- `components/onboarding/checklist-widget.tsx` (new) — the widget, mounted
  on `app/dashboard/page.tsx` above the pinnable widget grid.
- `app/api/onboarding/state/route.ts` — added `PATCH` proxy (previously
  GET-only).
- `app/api/onboarding/checklist/restore/route.ts`,
  `app/api/onboarding/milestones/[milestoneId]/self-mark/route.ts` (new
  proxies, same bearer-token pattern as the existing dismissals routes).
- `components/shell/help-launcher.tsx` — "Restore checklist" control
  (AC-010-05), calls the restore proxy.

## Decisions made (not pre-specified in the brief)

1. **`signalRefs` disambiguation.** Two items can share one
   `autoCompleteOn` kind (e.g. two `exercise_complete` items) — added an
   optional `signalRefs: string[]` to bind each item to a specific
   tour_id/exercise_id/milestone_id rather than matching the first hit.
2. **Restore is a dedicated endpoint, not a wider PATCH contract.**
   `PATCH /api/onboarding/state` uses COALESCE semantics that can't
   distinguish "field omitted" from "explicitly null" — widening it would
   break every other COALESCE'd field. `POST .../checklist/restore` sidesteps
   this with a plain `UPDATE`.
3. **Self-mark allowlist, not free-text `milestone_id`.** Prevents
   milestone-forgery via the self-mark endpoint; only `invite_admin` ships
   in M1.
4. **`connect-source` locked with `lockedUntilPhase: "post-v1"`.** The
   shared `Phase` schema only has `m1`/`m2`/`post-v1` (no literal `v1`) —
   used the closest available value rather than widening the enum, which
   would be a broader-impact change outside this task.
5. **AC-010-01 role_path filter (QA fix).** The widget originally passed
   the full `CHECKLIST_ITEMS` set to `deriveChecklist` with no filter,
   leaking admin-only items to every path. Fixed by filtering on
   `item.paths.includes(state.role_path)` before deriving — `role_path`
   added to the bootstrap-state shape the widget reads.
6. **XT-ONB010-1 auto-dismiss anchor (QA follow-up, folded in).** The
   7-day window originally anchored on the latest tour `completed_at`,
   which can predate finishing the whole checklist (early dismissal). Now
   anchors on `state.checklist_completed_at` — the widget PATCHes that
   field once, the first render where `derived.allComplete` is true and
   the field is still null, then reads it back as the sole anchor on
   subsequent renders.

## Not done / deferred

- **Playwright/docker E2E** (Law B: browser-automated, backend-state
  assertion) — not run this pass, per explicit coordinator instruction to
  avoid docker/Playwright in the QA-fix pass. Vitest component tests +
  `vitest-axe` cover the same widget logic and axe-cleanliness, but no
  real-browser round-trip (self-mark/dismiss actually mutating backend
  state via HTTP) has been exercised. Tracking: needs an isolated
  `COMPOSE_PROJECT_NAME=weaveonb010` Playwright pass in a follow-up.
- **AC-010-04 widget-level end-to-end auto-dismiss test.** `shouldAutoDismiss`
  is unit-tested in isolation (window arithmetic) and the
  mark-completed→anchor wiring is covered by the QA regression test
  (celebration renders at 100%), but no single test drives
  100%-complete → `checklist_completed_at` PATCH → 7-days-elapsed →
  auto-dismiss through the live component in one flow.

## Test/gate results (this pass)

- `tsc --noEmit` (frontend + shared): 0 errors.
- `eslint` (frontend, onboarding-scoped): 0 errors, warnings only
  (pre-existing style classes: `max-lines-per-function`,
  `sonarjs/no-duplicate-string`).
- `vitest run` — frontend 300/300 files, 1471/1471 tests green (full
  suite); shared 9/9 files, 52/52 green. Coverage well above 80%
  (last full-suite measurement: 88.27% stmts / 91.21% lines).
- `vitest-axe` on `ChecklistWidget`: 0 violations.
- Backend (`4b8ef44f`, prior pass): ruff/mypy clean, unit + integration
  (isolated docker, `COMPOSE_PROJECT_NAME=weaveonb010`) green. RLS +
  explicit `WHERE tenant_id = $n` confirmed on all new/changed queries; no
  migration needed (restore is a plain `UPDATE`, `checklist_completed_at`
  reused an existing column added by TASK-001's migration).

## Commits (on `feature/ONB-EPIC-005`)

- `feat: TASK-010 backend support for onboarding checklist widget` (`4b8ef44f`)
- `test: signal-derivation logic + new checklist items for TASK-010 widget` (`5d1f7d28`)
- `feat: onboarding proxy routes for checklist restore + self-mark (TASK-010)` (`2d580a94`)
- `feat: onboarding checklist widget on the Platform Dashboard (TASK-010)` (`6826f517`)
- `feat: checklist restore control + axe/keyboard coverage (TASK-010)` (`43cf1cf3`)
- QA repro test commit: `test: add edge case tests for TASK-010 (path-filtering + auto-dismiss anchor)` (`9d47ed12`)
- This pass's fix commit (path filter + XT-ONB010-1 anchor + this summary)
