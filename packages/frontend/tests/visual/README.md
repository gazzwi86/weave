# Visual regression

Two independent suites, two configs, two baseline sets. Neither touches
`tests/e2e/` or `e2e/ui-verify/` (existing, separate visual infra) -- this is
new coverage, not a replacement.

## 1. Shell states (`shell.spec.ts`)

Baselines for the app shell chrome -- the only signed-off app surface today
(see `docs/design/remediation-2-api-gaps.md` T1). Backend is deliberately
**not** started (`playwright.visual.config.ts`'s `webServer` list): every
shell surface that would otherwise show live data degrades to a static
error/empty state, which is actually the more deterministic baseline. The
frontend dev server + the standalone mock OIDC provider (`weave-mock-oidc`,
no backend dependency) are what's started.

States covered: `/ce` default, sidebar collapsed, notifications flyout,
help flyout, user menu, command palette (⌘K).

### Dark-mode coverage (T1b)

Two Playwright projects: `chromium` (light, the default `colorScheme`) and
`chromium-dark` (`use: { colorScheme: 'dark' }`), so every shell state gets
a real capture under `app/globals.css`'s `@media (prefers-color-scheme: dark)`
rule, not just a relabelled light screenshot. `snapshotPathTemplate` includes
`{projectName}` so the two projects' baselines live in separate
`__screenshots__/shell.spec.ts/chromium/` and `.../chromium-dark/` folders
instead of colliding on the same file path.

### Run

```bash
npm run test:visual
```

### Rebaseline

```bash
npm run test:visual:update
git add tests/visual/__screenshots__/shell.spec.ts/
```

### The rule: real user interactions only

Every shell state above is reached by a real click on a visible element or a
real keyboard shortcut (`page.getByRole(...).click()`, `page.keyboard.press("Meta+k")`).
**Never `page.evaluate()` to call an app function directly** -- a past bug
was masked exactly that way (state changed in the store but the UI never
actually rendered it, and a `page.evaluate()`-driven test couldn't tell the
difference). If a state can't be reached by clicking/typing like a real user
would, that's a product bug to fix, not a test to route around.

### Backend-down determinism

No `mask:` regions are needed today -- with the backend down, notifications
and the user avatar settle on static error/placeholder text instead of live
timestamps or seeded content. If a future baseline run adds the real
backend, re-introduce `mask:` for the notification rows' relative-time text
before rebaselining, or the suite will flake on every run.

## 2. Storybook per-story baselines (`storybook.spec.ts`)

One baseline per story in the catalogue (273 at last count -- grew from 109
once the design-system component library landed), screenshotting just the
`#storybook-root` element (not the full iframe canvas).

### Dark-mode coverage (T1b)

Every `*Dark`-suffixed story export (e.g. `DefaultDark`) gets a
deterministic `-dark`-suffixed Storybook id (e.g. `atoms-button--default-dark`).
Before each story loads, the spec calls `page.emulateMedia({ colorScheme })`,
`dark` for those ids and `light` for every other id -- exercising the app's
real `prefers-color-scheme` CSS path directly, not a Storybook decorator or
`data-theme` attribute (the app has neither). A dedicated acceptance test
("storybook: dark mode actually renders dark") reads `--color-bg` off
`document.documentElement` for a Dark/Light story pair and asserts the
values differ, so a regression that silently drops the `emulateMedia` call
fails a real assertion instead of only drifting pixels that
`--update-snapshots` would happily re-bless.

### Portal-based dialogs and the root-attachment sanity check (found during T1b)

Rebuilding `storybook-static/` for this task (stale since 239, current
catalogue is 273 stories) surfaced 34 stories --
`ConfirmDialog`/`Drawer`/`DocDrawer`/`EntityEditDrawer`/`EntityPickerModal`/`ModalShell`,
added in earlier unrelated commits -- that had never been baselined at all.
They render via a React portal straight to `document.body`, so
`#storybook-root` has zero children even on a fully successful render; the
pre-existing "did the story actually render" sanity check
(`toBeAttached()` on root's first child, guarding against a real
crash/import error) only checked root's own children and timed out on all
34. Fixed by accepting either a root child (the common case) or a
portalled `[role="dialog"]` anywhere on the page -- unrelated to dark mode,
but blocking a clean baseline run so fixed alongside it.

### Why not `@storybook/test-runner`

That package pins its own `jest-worker` + `playwright-core`, duplicating the
`@playwright/test` this repo already runs everything else on, for what
Storybook's own `index.json` + `iframe.html` give directly with no extra
dependency. This is the documented fallback: build Storybook statically,
read `storybook-static/index.json` for the story list, screenshot each
story's `iframe.html?id=...` page.

Playwright registers every `test()` call synchronously while parsing the
spec file -- there's no `"type": "module"` in this package's `package.json`,
so top-level `await fetch(...)` isn't available. That's why the story list
is read with a synchronous `fs.readFileSync` from a **pre-built**
`storybook-static/index.json`, not fetched live from a running `storybook
dev` server. `npm run build-storybook` runs before Playwright in both npm
scripts below for that reason -- don't invoke
`playwright test --config=playwright.storybook-visual.config.ts` directly
without it, the spec will throw `ENOENT` on `storybook-static/index.json`.

The static build output is served by `python3 -m http.server` (stdlib, no
new devDependency) rather than a `serve`/`http-server` package.

### Run

```bash
npm run test:storybook-visual
```

### Rebaseline

```bash
npm run test:storybook-visual:update
git add tests/visual/__screenshots__/storybook.spec.ts/
```

### Masking

Every screenshot masks `<time>` elements unconditionally. `RelativeTime`
("3 hours ago") is the only clock-driven content in the story catalogue
today (`BellPanel.stories.tsx`'s `TODAY`/`YESTERDAY` fixtures render through
it) -- masking it blanket means no story needs special-casing if a future
story adds another live timestamp.

## Determinism

Both configs pin font rendering (`--font-render-hinting=none` etc, matching
`e2e/ui-verify/playwright.config.ts`'s rationale) and disable animations
(`expect.toHaveScreenshot.animations: "disabled"`, `reducedMotion: "reduce"`)
so a baseline generated on a dev machine doesn't drift against a rerun on
the same machine or in CI. `maxDiffPixelRatio: 0.001` is tight on purpose --
a deterministic shell/story render has no excuse for pixel drift once
fonts/animations are pinned.

Both suites were run twice consecutively during development with zero
diffs on the second run -- see the git history for this directory.

### Determinism hazards found during the shell-refit rebaseline

This dev machine runs several agent worktrees in parallel, each capable of
starting its own `next dev` / backend / Storybook dev server. Both configs
used to bind the *shared, conventional* default ports (frontend `3000`,
Storybook `6006`) with `reuseExistingServer: true`, which trusts whatever
already answers on that port -- it does not check the answer came from
*this* worktree. Two failure modes surfaced from that:

- **Wrong dev server reused**: a sibling worktree's `next dev` was already
  listening on `3000`. This suite's `reuseExistingServer: true` screenshotted
  *that* worktree's build, not this one's.
- **Live backend reused**: a sibling worktree's real backend was listening
  on `8000` (this suite's `webServer` deliberately never starts one). The
  shell fetched real workspace state through it -- including a "Practice
  mode" banner -- shifting every pixel below the header and blowing the
  `0.001` diff ratio on `/ce default`, `sidebar collapsed`, and
  `command palette open`, and flipping `notifications flyout open`'s
  expected error state to a real (empty) list.

Fix (in `playwright.visual.config.ts` / `playwright.storybook-visual.config.ts`):
this suite's own dev server now binds a port off the shared convention
(`3500` for `next dev`, `6500` for the Storybook static server) instead of
the defaults every worktree reaches for, and the frontend's upstream is
pinned to `BACKEND_API_URL=http://127.0.0.1:1` (port 1 is privileged --
nothing can bind it without root, so "backend down" is guaranteed true
regardless of what else is running on the machine) unless the environment
already sets `BACKEND_API_URL`. This is a workstation port-contention
hazard, not a code defect in the app -- documenting it here rather than a
`mask:` region, since no pixel-level mask fixes a page that fetched the
wrong data entirely.

### Practice-mode banner is a timing race, not a stable backend-down state

Found during the T1b dark-mode rebaseline: `help flyout open` and
`user menu open`'s previously-committed baselines showed the "Practice
mode" banner (`components/onboarding/practice-mode-banner.tsx`); a fresh
capture on this same commit does not. The banner's own logic is a plain
`if (!sandbox?.sandbox_forked_at) return null` after a `fetch("/api/onboarding/state")`
that's expected to fail with the backend pinned unreachable -- so "banner
absent" is the logically-correct backend-down state, and the previously
committed baseline was likely captured while some other locally-reachable
service answered that fetch (the same class of contamination as the
port-contention hazard above, just via `/api/onboarding/state` rather than
the frontend/backend dev-server ports already pinned). Two consecutive
fresh runs in this session matched each other exactly (true determinism
within a session) but not the older baseline -- so this is a capture-time
environmental flake, not a suite regression. The regenerated baselines
(banner absent) were kept as the more-correct capture.

## Intended CI job (not wired into `.github/workflows/` by this task)

```yaml
visual-regression:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version-file: "packages/frontend/.nvmrc" }
    - run: npm ci
      working-directory: packages/frontend
    - run: npx playwright install --with-deps chromium
      working-directory: packages/frontend
    - run: npm run test:visual
      working-directory: packages/frontend
    - run: npm run test:storybook-visual
      working-directory: packages/frontend
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: visual-regression-diffs
        path: packages/frontend/test-results/
```

The `--font-render-hinting=none` etc launch args (same as
`playwright.visual.config.ts`/`playwright.storybook-visual.config.ts`) are
the primary defence against macOS-vs-Linux font-AA drift -- these baselines
were generated locally on macOS on that assumption. If the first CI run
against them still diffs, that's the signal the font-pinning alone isn't
enough here (unlike `e2e/ui-verify`); reseed once with
`npm run test:visual:update && npm run test:storybook-visual:update` on the
CI runner image and commit, same recipe `tests/e2e/visual-baselines.spec.ts`
documents for its own suite.
