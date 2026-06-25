# Testing — universal base

**Stack-agnostic.** Per-stack frameworks and syntax live in
`templates/standards/<lang>/testing.md`.

## Test-Driven Development

All implementation follows TDD:

1. **RED** — write a failing test that pins the desired behaviour.
2. **GREEN** — write the minimum code to pass.
3. **REFACTOR** — clean up while tests stay green.

## The pyramid

| Layer | Target % of suite | Framework (see stack-equivalents.md) |
|---|---|---|
| Unit | 70% | Vitest / pytest / JUnit / XCTest |
| Integration | 20% | Same framework, against real DB via Testcontainers or local emulator |
| Contract | 5% | Pact / Schemathesis / Spring Cloud Contract |
| E2E / Browser | 5% | Playwright (default), Selenium, Cypress, Puppeteer, XCUITest |

Ratios are a guide, not a law. Sustained deviation is a smell.

## Quality rules

Every task must have:

- Explicit, named test scenarios.
- Minimum test-type counts declared in the task brief DoD.
- AC-to-test mapping — every acceptance criterion has at least one test.

Tests must be:

- **Deterministic** — same input, same result, every run.
- **Independent** — no test depends on another test's state.
- **Fast** — unit tests complete in under 100 ms each.
- **Readable** — the test name describes the scenario end-to-end.

Tests must not:

- Mock business logic (mock only at system boundaries).
- Share mutable state between tests.
- Contain control flow (`if`/`for` branches in the assertion path).

## Coverage thresholds

| Metric | Minimum | Enforcement |
|---|---|---|
| Line | 80% | CI blocks merge |
| Branch | 75% | CI warns |
| Function | 80% | CI blocks merge |

## Mocking policy

**Always mock:** external HTTP, time/clock, randomness, filesystem, cloud APIs (use LocalStack / Azurite / moto / Testcontainers for integration layer instead of per-call mocks).

**Never mock:** pure functions, own business logic, UI rendering, state management internals.

## Browser automation (Plugin Law B / Engineer Law 16)

UI-bearing projects ship real browser automation that drives the primary user flows AND asserts backend state changed. Required scenes: anonymous landing, sign-up, login, named happy paths from the brief, one error recovery, logout. Screenshot-diff alone is not sufficient.

Non-UI projects ship equivalent integration tests invoking the produced binary or infra against a local emulator.

## E2E conventions

- Selectors: `data-testid` only. Never select by class, tag, or visible text.
- Page Object Model for non-trivial flows.
- Capture screenshots + traces at flow boundaries for debugging.
- Axe-core accessibility check on every primary page; target zero violations.

## Mandatory E2E coverage (Engineer Law 17, QA Category 12)

For every PRD user-journey, an E2E spec MUST exist that drives the journey end-to-end **including the happy path**, not only error/redirect cases:

- **Auth happy path**: enter email → confirmation shown → click magic-link → land on authenticated page (assert session cookie + DB row).
- **Browse → cart → checkout → order**: complete one purchase end-to-end (Stripe mock-mode in headless), assert order row exists with non-empty line items.
- **GDPR self-service**: trigger export, assert ZIP returned with correct contents; trigger erasure, assert tombstone row + 30-day timeline entry.

A failing-redirect-only spec or a "smoke that loads the page" does NOT satisfy this category. The QA spec-coverage audit (Category 12) walks every PRD user-journey and marks DELIVERED / STUB / MISSING.

## Coverage tooling — install at scaffold time

Coverage thresholds are not optional. The scaffold phase MUST install the coverage provider as a devDependency:

- TS/JS: `@vitest/coverage-v8`.
- Python: `pytest-cov` + `coverage[toml]`.
- Java: JaCoCo plugin in pom.xml.
- Swift: `swift test --enable-code-coverage` (built-in) + `xcrun llvm-cov` for report generation.

Without these, the `coverage.thresholds` config enforces nothing. The QA agent (executable DoD per Law 9) MUST verify that `npm run test -- --coverage` (or stack equivalent) outputs real coverage numbers AND fails the run when below threshold. Mark Category 2 (Test Coverage) as `WARN` if coverage tooling is configured but absent from devDependencies.

---

*Override per stack in `templates/standards/<lang>/testing.md`.*
