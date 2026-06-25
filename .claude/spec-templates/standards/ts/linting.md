# Linting Standards

## ESLint Configuration

Weave enforces code quality through ESLint with the SonarJS plugin for complexity analysis.

### Required Plugins

```json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript",
    "plugin:sonarjs/recommended-legacy"
  ],
  "plugins": ["sonarjs"],
  "rules": {
    "complexity": ["error", 10],
    "sonarjs/cognitive-complexity": ["error", 15],
    "max-lines-per-function": ["warn", { "max": 50, "skipBlankLines": true, "skipComments": true }],
    "max-lines": ["warn", { "max": 300, "skipBlankLines": true, "skipComments": true }],
    "sonarjs/no-duplicate-string": ["warn", { "threshold": 3 }],
    "sonarjs/no-identical-functions": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

## Complexity Thresholds

| Metric | Threshold | What It Measures | Action on Violation |
|--------|-----------|-----------------|-------------------|
| Cyclomatic complexity | <= 10 | Number of linearly independent paths | Error: refactor into smaller functions |
| Cognitive complexity | <= 15 | How hard code is to understand | Error: simplify control flow |
| Function length | <= 50 lines | Size of individual functions | Warning: consider decomposition |
| File length | <= 300 lines | Size of individual files | Warning: consider splitting |
| Duplicate strings | <= 3 occurrences | Repeated magic strings | Warning: extract to constant |

## What These Thresholds Prevent

- **Cyclomatic > 10:** Function has too many branches. Split into smaller, testable units.
- **Cognitive > 15:** Nested conditions, complex boolean logic. Flatten with early returns, extract helpers.
- **Long functions:** Doing too much. Single Responsibility Principle applies.
- **Long files:** Module is too broad. Split by concern.

## TypeScript Strict Mode

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Pre-commit Checks

The Engineer agent runs these before every commit:
1. `eslint --fix` (auto-fix what's possible)
2. `tsc --noEmit` (type check)
3. `vitest run --changed` (run affected tests)

## Handling Violations

When the agent encounters lint errors:
1. **Auto-fixable:** Apply `--fix` automatically
2. **Complexity violation:** Decompose the function (extract helper functions)
3. **Type error:** Fix the type, never use `as any` or `@ts-ignore`
4. **Cannot resolve:** Document in QA failure report with recommendation

---
*Opinionated defaults from Weave. Override in docs/standards/linting.md*
