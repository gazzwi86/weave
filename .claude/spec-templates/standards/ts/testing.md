# Testing Standards

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
class GamePage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/game');
  }

  async selectNumber(n: number) {
    await this.page.click(`[data-testid="number-${n}"]`);
  }

  async getSelectedNumbers(): Promise<number[]> {
    // ...
  }
}
```

## Playwright E2E Best Practices

- **Screenshots**: Capture screenshots at key flow steps (saved to `test-results/`). Use `await page.screenshot({ path: 'test-results/step-name.png' })` after significant interactions.
- **Accessibility**: Run `axe-playwright` accessibility checks on each page. Install `@axe-core/playwright` and assert zero violations: `expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])`.
- **Selectors**: Use `data-testid` selectors only. Never select by class name, tag, or text content.

---
*Opinionated defaults from Weave. Override in docs/standards/testing.md*
