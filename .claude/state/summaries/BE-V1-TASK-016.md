# Progress: BE-V1-TASK-016 — Ontology Pin Upgrade (FR-012, CE-DIFF-1 Diff + Explicit Confirm)

`build-engine` EPIC-002. Backend proxy + frontend diff-review/confirm UI for upgrading a project's
pinned ontology version, against the CE-DIFF-1 contract.

## Outcome

All local gates green. Vitest **8/8** new component tests + **2 new** panel-wiring tests, all
passing. New-file coverage: `pin-upgrade-section.tsx` 94% lines/93% branch, `pin-diff/route.ts` 92%,
`pin-upgrade/route.ts` 89% — all clear of the 80% gate. `npm run lint`: **0 errors**, 4 warnings
(pre-existing test-file conventions: `max-lines-per-function` on `describe` blocks,
`sonarjs/no-duplicate-string` on repeated fixture strings — same pattern as every other test file in
the repo, not new debt). `npx tsc --noEmit`: clean. No `console.log`. Backend `uv run pytest`: all
green (routes were built in the prior segment, unmodified here).

## What shipped

- **Backend proxy routes** (`packages/frontend/app/api/build/projects/[id]/pin-diff/route.ts`,
  `.../pin-upgrade/route.ts`) — GET forwards to CE-DIFF-1; POST validates body with zod
  (`{ confirm_version_iri: z.string().min(1) }`, Law 13) before forwarding.
- **`PinUpgradeSection`** (`packages/frontend/app/build/projects/[id]/settings/pin-upgrade-section.tsx`)
  — "Review upgrade" trigger + native `<dialog>` diff view/confirm flow. States: loading
  (`aria-busy` on the dialog), no-diff (already latest — plain empty-state text), CE-DIFF-1
  unavailable (`role="alert"`), confirm-in-progress (`aria-busy` on the confirm button), success
  (`role="status"`). Diff rows pair colour with a text `Badge` ("Added"/"Removed"/"Changed") —
  colour never carries meaning alone (WCAG 1.4.1). Breaking versions require a second explicit
  checkbox acknowledgement before the confirm button enables.
- **Wired into Governance tab** (`project-settings-panel.tsx`) — reuses the panel's existing
  `settings.canManage` (`deriveProjectRole(...) === "admin"`, from TASK-015) rather than
  re-deriving; no admin duplication.
- **Playwright E2E** (`tests/e2e/pin-upgrade.spec.ts`, 2 scenarios) — asserts BACKEND STATE (Law B):
  confirming actually moves `pinned_graph_version_iri`, proven via an independent
  `GET /api/build/projects/{id}` after confirm; non-admin trigger hidden + forced POST 403s
  server-side. Same convention as `project-settings.spec.ts`/`versions-publish.spec.ts` — needs the
  live dev stack, runs at epic-close `ui_verify`, not executed in this pass.

## GAP resolutions (brief's `## GAPS` section)

- **AC-3 (409 pin-moved race)**: on 409, the confirm handler resets the breaking-acknowledgement
  checkbox, shows a `role="alert"` conflict message ("The ontology changed again while you were
  reviewing"), and immediately re-fetches the diff — never applies a stale confirm silently.
- **AC-6 (non-admin trigger)**: `PinUpgradeSection` returns `null` when `canManage` is false — the
  trigger doesn't render at all for non-admins. The server's 403 on `pin-upgrade` remains the real
  boundary (UI hide is UX-only, matching TASK-015's role-gating convention); proven end-to-end in
  the Playwright non-admin scenario.

## Decisions / design

- Built against `docs/standards/design/` tokens throughout (`--color-success/warn/danger`,
  `--space-*`, `--radius-lg`, `--font-mono` for IRIs, `--text-h4/body/body-sm`) — no ad-hoc hex/px.
- **No new global motion/keyframe CSS added.** Confirmed `motion.md` defines a six-keyframe contract
  but zero `@keyframes` exist anywhere in `app/globals.css` today — no component in the codebase
  (including the reference `new-project-modal.tsx`) implements it yet. Matched that existing
  precedent (no animation on this dialog either) rather than building new motion infrastructure as
  a side effect of this task — out of scope per "touch only what you must". Flagging as a pre-
  existing spec-vs-implementation gap, not new debt from this task.
- Complexity budget (Law E): the first draft of `PinUpgradeSection` hit cyclomatic 11 (>10, error)
  and 85 lines (>50, warning). Fixed by extraction, not suppression — `usePinUpgradeDialog` custom
  hook owns the async state machine; `DialogFooter`/`UpgradeStatusMessages`/`DiffRows`/`DiffBody`/
  `BreakingAck` are small presentational splits. No `eslint-disable` used anywhere.
- Native `<dialog>` element (focus trap/Escape/restore for free) — same pattern as
  `new-project-modal.tsx`. jsdom needs a `showModal`/`close` polyfill in tests (copied verbatim from
  `new-project-modal.test.tsx`).

## Gates

- Vitest: 8/8 (`pin-upgrade-section.test.tsx`) + 2/2 new (`project-settings-panel.test.tsx`) +
  route tests, all pass. Full frontend suite (106 files/537 tests) still green after wiring.
- ESLint: 0 errors on all new/changed files. `tsc --noEmit`: clean.
- Coverage on new components: 89-94%, all ≥ 80%.
- Backend `pytest`: full suite green (routes unmodified this segment).
- Playwright E2E: written + type-checked, not run locally (no live stack) — runs at epic-close
  `ui_verify`, same convention as every other UI task in this epic.

## Commits

- `e46100c` backend pin-diff/pin-upgrade routes (FR-012)
- `6c0598f` frontend proxy routes (pin-diff GET, pin-upgrade POST) + route tests
- `76e0cfa` `PinUpgradeSection` diff view + explicit-confirm dialog + 8-test suite
- `9dc6dc2` wire trigger into Governance tab + 2 panel tests
- `35ba6af` Playwright E2E (`pin-upgrade.spec.ts`, Law B backend-state-proof)

## Known / open items

- Motion/keyframe infra gap noted above — pre-existing, not blocking, candidate for a design-system
  follow-up task (not this one).
- Playwright E2E not run locally — needs live stack, deferred to epic-close `ui_verify` per
  established convention.
