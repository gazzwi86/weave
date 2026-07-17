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

One baseline per story in the catalogue (109 at last count), screenshotting
just the `#storybook-root` element (not the full iframe canvas).

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
diffs on the second run (the first shell run picked up a cold Next.js dev
server compile; every run after that was clean) -- see the git history for
this directory.

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
