---
type: Coding Standard
title: TypeScript Testing — Coding Standard
description: "TypeScript testing standards: vitest, Playwright, coverage."
tags: [standards, testing, typescript]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/testing-ts.md
---

# Testing Standards — TypeScript

> Python testing standards: see [`testing-py.md`](testing-py.md).

## Test-Driven Development (TDD)

All implementation follows the TDD cycle:

```
1. RED:    Write a failing test
2. GREEN:  Write minimal code to pass
3. REFACTOR: Clean up while tests stay green
```

## Frameworks

| Type | Framework | When to Use |
|------|-----------|-------------|
| Unit | Vitest | Business logic, utilities, pure functions |
| Component | Testing Library + Vitest | React components, user interactions |
| Integration | Vitest | API routes, data flows, multi-module |
| E2E | Playwright | Full user flows, browser interactions |

## Test Quality Rules

### Every task MUST have:
- Explicit test scenarios (named, with expected behavior)
- Minimum test type counts (defined in task brief)
- AC-to-test mapping (every acceptance criterion has a test)

### Tests MUST be:
- **Deterministic** -- same input, same result, every time
- **Independent** -- no test depends on another test's state
- **Fast** -- unit tests < 100ms each
- **Readable** -- test name describes the scenario completely

### Tests MUST NOT:
- Mock business logic (only mock at system boundaries)
- Use `any` type assertions
- Have conditional logic (if/else in tests)
- Share mutable state between tests

## Naming Convention

```typescript
describe('ComponentOrFunction', () => {
  describe('methodOrBehavior', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange: set up test data
      // Act: perform the action
      // Assert: verify the result
    });
  });
});
```

## Coverage Thresholds

| Metric | Minimum | Enforcement |
|--------|---------|-------------|
| Line | 80% | CI blocks merge |
| Branch | 75% | CI warns |
| Function | 80% | CI blocks merge |

## Mocking Strategy

### Always Mock:
- External HTTP APIs (use MSW)
- Time-dependent functions (use `vi.useFakeTimers()`)
- Random number generation (use seeded generators)
- File system operations

### Never Mock:
- Business logic functions
- Utility/helper functions
- React component rendering
- State management internals

## E2E Test Patterns

```typescript
// Page Object Model for E2E tests
class GraphExplorerPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/graph');
  }

  async clickEntity(id: string) {
    await this.page.click(`[data-testid="entity-${id}"]`);
  }

  async getVisibleEntityLabels(): Promise<string[]> {
    // ...
  }
}
```

## Playwright E2E Best Practices

- **Screenshots**: Capture at key flow steps into `test-results/`. Use `await page.screenshot({ path: 'test-results/step-name.png' })` after significant interactions.
- **Accessibility**: Run `axe-playwright` on each page: `expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])`. Zero violations required.
- **Selectors**: `data-testid` only. Never select by class name, tag, or text content.

## Mutation Testing

Mutation testing verifies test quality, not just coverage. CLAUDE.md mandates ≥ 70% mutation score.

**Tool:** [Stryker](https://stryker-mutator.io/) with `@stryker-mutator/vitest-runner`.

```bash
npx stryker run
```

**`stryker.config.mjs`:**

```js
export default {
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.d.ts'],
  thresholds: { high: 80, low: 70, break: 65 },
};
```

**Principle:** A mutation that survives (is not killed by any test) reveals a test gap — either a missing assertion or a missing scenario. When Stryker surfaces a surviving mutant, add a test that catches it rather than raising the threshold.

## Visual Regression

Every generated UI component is captured in its **8 named visual states** and diffed against a
stored baseline. This is the Build Engine's "visual-state capture", which replaces the
previously-undefined "F25 visual test" (see `docs/specs/build-engine/02-prd/prd.md`, lines
486-487). Playwright is the capture tool; the Playwright-vs-Puppeteer choice and baseline
storage are formally open as OQ-03 (`build-engine/02-prd/prd.md`, line 769), and this standard
is written Playwright-first to match the existing prototype harness
(`prototypes/weave-prototype/frontend/playwright.config.ts`).

### The 8 states

Every interactive component MUST have a baseline screenshot for each applicable state. States
that genuinely cannot occur for a component (e.g. a static label has no `loading`) are
explicitly skipped with a one-line comment — never silently omitted.

| State | Meaning |
|-------|---------|
| `default` | Initial render, no interaction |
| `hover` | Pointer over the primary interactive target |
| `focus` | Keyboard focus on the primary target |
| `active` | Pressed / actuated (e.g. mid-click, toggled on) |
| `disabled` | Non-interactive, `aria-disabled` / `disabled` set |
| `loading` | Async work in flight (spinner / skeleton) |
| `empty` | Valid render with no data (empty list, no results) |
| `error` | Error boundary or failed-fetch presentation |

### Capture convention

- Capture file names are deterministic: `<Component>--<state>.png` under
  `e2e/visual/__screenshots__/`. One state per assertion.
- Use Playwright's snapshot assertion so the diff and baseline are managed by the runner:

```typescript
import { expect, test } from '@playwright/test';

const STATES = [
  'default', 'hover', 'focus', 'active',
  'disabled', 'loading', 'empty', 'error',
] as const;

for (const state of STATES) {
  test(`EntityCard — ${state} state matches baseline`, async ({ page }) => {
    await page.goto(`/__visual__/EntityCard?state=${state}`);
    const card = page.getByTestId('entity-card');
    await expect(card).toHaveScreenshot(`EntityCard--${state}.png`, {
      maxDiffPixelRatio: 0.01,
    });
  });
}
```

- Determinism: disable animations and freeze time before capture (`vi`-style fake clock is not
  available in Playwright — use `page.clock` or CSS `prefers-reduced-motion`), so a diff only
  ever signals a real visual change.
- `maxDiffPixelRatio` is fixed at `0.01` (1%). A larger drift fails the test; do not raise it to
  make a flaky capture pass — fix the non-determinism instead.

### CI screenshot-diff gate

- The `e2e` CI job runs the visual suite after the functional Playwright suite (mirrors
  `prototypes/weave-prototype/.github/workflows/pr.yml`, which already runs Playwright +
  Lighthouse in one job).
- Any unmatched baseline (new or drifted) **blocks merge**. The job uploads
  `test-results/**/diff.png` as an artifact so the reviewer sees before/after/diff.
- Baselines are updated only by an intentional `npx playwright test --update-snapshots` commit,
  reviewed like any other code change. A drifted baseline is never auto-accepted in CI.

## Performance / Load Testing

PRD performance budgets (p95 latency, fps, node count) are **asserted in CI**, not just
documented. A budget that is not enforced is a wish. Each budget maps to a measurement tool and
a hard threshold that blocks merge when breached.

### Budgets and their assertion mechanism

| Budget (source) | Default target | Asserted by |
|-----------------|----------------|-------------|
| Graph canvas load @ 1k / 10k nodes (`graph-explorer/02-prd/prd.md` 609) | ≤ 3 s / ≤ 8 s p95 | Playwright trace |
| Node-drag frame budget (`graph-explorer/02-prd/prd.md` 612) | ≤ 16 ms (60 fps) @ 1k nodes | Playwright trace + `requestAnimationFrame` sampling |
| SPARQL SELECT p95 (`constitution-engine/02-prd/prd.md` 578) | < 500 ms | k6 threshold |
| Dashboard initial load (`weave-platform/02-prd/prd.md` 776) | ≤ 2 s p95 | Lighthouse + Playwright trace |
| Lighthouse performance score (`prototypes/weave-prototype/frontend/lighthouserc.json`) | ≥ 0.8 | Lighthouse CI |

Targets are tagged *default / tunable* in the PRDs and several depend on the OQ-01 benchmark
harness (`graph-explorer/02-prd/prd.md` 615-616). The standard is: the CI threshold reads the
*current agreed* number from a single config; when OQ-01 re-derives a tier, the config changes
in one place and CI follows.

### Front-end interaction budgets — Playwright traces

Capture a trace, then assert on measured durations. Do not eyeball; assert numerically.

```typescript
import { expect, test } from '@playwright/test';

test('canvas loads 1k nodes within p95 budget', async ({ page }) => {
  await page.goto('/graph?fixture=1k');
  const loadMs = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return performance.now() - nav.startTime;
  });
  expect(loadMs).toBeLessThanOrEqual(3000); // graph-explorer FR-003 default
});

test('node drag holds 60 fps (16ms frame budget)', async ({ page }) => {
  await page.goto('/graph?fixture=1k');
  const longFrames = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      let last = performance.now();
      let over = 0;
      let n = 0;
      const tick = () => {
        const now = performance.now();
        if (now - last > 16.7) over += 1;
        last = now;
        if (++n < 120) requestAnimationFrame(tick);
        else resolve(over);
      };
      requestAnimationFrame(tick);
    });
  });
  expect(longFrames).toBeLessThanOrEqual(6); // ≤5% of 120 frames may overrun
});
```

- fps sampling method, hardware, and node/edge counts follow the OQ-01 harness definition
  (`graph-explorer/02-prd/prd.md` 615) — a perf test must declare which tier it asserts.

### Lighthouse — page-level budgets

Lighthouse CI is already wired in the prototype (`lighthouserc.json`, `lint:lighthouse` →
`lhci autorun`). Performance and best-practices score as `warn`; **accessibility ≥ 0.9 is an
`error`** and blocks merge. Promote the performance budget to `error` for any page with a PRD
p95 commitment rather than leaving it advisory.

### k6 — backend latency / load budgets

API and SPARQL p95 budgets are asserted with [k6](https://k6.io/) `thresholds`. A breached
threshold exits non-zero and fails the CI job.

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    // constitution-engine PRD: SPARQL SELECT p95 < 500ms
    'http_req_duration{endpoint:sparql}': ['p(95)<500'],
  },
};

export default function () {
  const res = http.post(
    `${__ENV.BASE_URL}/sparql`,
    'SELECT ?s WHERE { ?s a ?t } LIMIT 10',
    { headers: { 'Content-Type': 'application/sparql-query' }, tags: { endpoint: 'sparql' } },
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

- Thresholds are p95 (matching the PRD wording), never average. A test that asserts the mean
  hides tail latency and does not satisfy the budget.
- Load-test node counts and concurrency match the PRD's stated conditions (e.g. 5 concurrent
  users for collaborative cursor sync, `graph-explorer/02-prd/prd.md` 614).

---
