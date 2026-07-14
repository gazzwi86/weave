# ONB-TASK-013 — Help Launcher & Contextual Help Panel

## Status: delivered (partial — one AC pair deferred, escalation filed)

## What shipped

Extended the existing `packages/frontend/components/shell/help-launcher.tsx`
(built by ONB-010's checklist-restore button and ONB-V1-002's completeness-map
tour entry) rather than creating a new component:

- **AC-013-03 (keyboard shortcut)**: `useShortcutOpen` hook listens for `?`
  keydown on `document`, guarded by an `isTextField` predicate
  (`input, textarea, [contenteditable]` via `closest`) so typing `?` in a
  field never opens the panel. Escape-to-close comes free from Radix Dialog
  (already wired). Dialog is now a controlled `open`/`onOpenChange` so the
  keyboard hook can drive it.
- **AC-013-04 (contextual help panel)**: new shared config
  `packages/shared/onboarding/content/contextual-help.ts` — `CONTEXTUAL_HELP`
  keyed by `AreaId` (same phase-tag pattern as tours), `areaForPathname()`
  maps a route prefix to an area. Only `constitution` and `explorer` have
  entries today (the only M1 areas with shipped screens); every other area
  renders nothing — the "Help for this page" `<nav>` is entirely absent, not
  an empty box.
- **AC-013-05 (entries resolve live surfaces)**: added "Show all hints"
  (`DELETE /api/onboarding/dismissals/beacon`, TASK-008's real bulk-restore
  route), "Training library / What's new" (links to `/help/training`,
  TASK-012's real page), "Change my onboarding path" (links to
  `/settings/onboarding-path`, TASK-006's real page). The pre-existing
  checklist-restore button (TASK-010) was kept as-is.
- **AC-013-06 (axe + i18n + unread dot)**: new `UnreadDot` reads
  `useWhatsNewUnread()` (TASK-012's hook, not duplicated) and renders a
  `data-testid="help-launcher-unread-dot"` marker on the `?` trigger. All new
  strings added to `packages/shared/onboarding/content/i18n/en.ts` under the
  `onboarding.launcher.*` namespace. `vitest-axe` assertion added to the test
  file; zero violations.

## What was deferred (AC-013-01 / AC-013-02) — see escalation

A generic "Take tour" entry (current area's tour, or a fallback list when the
area has none) was **not** built beyond the existing Explorer-only
completeness-map deep link. Traced every page: the only mounted tour-engine
host anywhere in the frontend is `components/explorer/explorer-tour.tsx` on
`/explorer`, and that host is itself hardcoded to
`tour.ge.completeness-map` — it ignores the actual `?tour=` value. No page
mounts `useTourEngine`/`TourOverlay` for the shipped m1 tours (`ce-overview`
on `/ce`, `ge-canvas` on `/explorer`). Building a generic per-area entry
would render dead links — the exact E7-S1 failure mode AC-013-02 exists to
prevent. Full detail and recommended unblocker (generalize `ExplorerTour`
into a `TourHost` that reads `tourId` from the query param, then mount an
equivalent host on `/ce`) is in
`.claude/state/escalations/ONB-TASK-013-partial.md`.

## Nuances / edge cases found

- **Fetch-on-mount regression**: `useWhatsNewUnread()` fetches
  `/api/onboarding/state` on mount. Two pre-existing test files
  (`app-shell.test.tsx`, `shell.a11y.test.tsx`) render `HelpLauncher` (via
  `AppShell` or directly) without mocking `fetch`, which previously never
  fired a network call from this component. Fixed by stubbing
  `global.fetch` in both files' `beforeEach` with
  `vi.spyOn(global, "fetch").mockImplementation(() => Promise.resolve(Response.json({})))`
  — note `mockResolvedValue` with a single `Response` instance breaks on the
  second call (`Body has already been read`); `mockImplementation` returning
  a fresh `Response.json({})` each call is required.
- **Worktree setup**: this worktree had no `node_modules` in either
  `packages/frontend` or `packages/shared` (git worktrees don't carry
  untracked `node_modules`). Ran `npm install` in both — this is the
  documented CI pattern (`packages/shared` needs its own install separately
  from `packages/frontend`), confirmed by diffing against the main
  checkout's install state, not a new decision.
- Coverage on `help-launcher.tsx` itself: 100% lines/statements, ~94%
  branches (well above the 80% floor).

## Verification run

- `npx vitest run components/shell/__tests__/help-launcher.test.tsx` — 17/17 pass
- `npx vitest run` (full frontend suite) — 329 files / 1628 tests pass, 0 unhandled errors
- `npm run typecheck` (frontend) — clean
- `npm run lint` (frontend) — 0 errors, 378 pre-existing warnings (none new)
- `npx tsx onboarding/scripts/audit-anchors.ts ../frontend` (from `packages/shared`) — passed, zero unregistered anchors (this task planted no new `data-tour-id` anchors, so this is a no-regression check)

## Files touched

- `packages/frontend/components/shell/help-launcher.tsx` (rewrite)
- `packages/frontend/components/shell/__tests__/help-launcher.test.tsx` (rewrite)
- `packages/frontend/components/shell/__tests__/app-shell.test.tsx` (fetch stub)
- `packages/frontend/components/shell/shell.a11y.test.tsx` (fetch stub)
- `packages/shared/onboarding/content/contextual-help.ts` (new)
- `packages/shared/onboarding/content/i18n/en.ts` (new keys)
- `.claude/state/escalations/ONB-TASK-013-partial.md` (new)
