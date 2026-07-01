---
type: Coding Standard
title: "Linting — ESLint Flat Config with typescript-eslint + SonarJS (typescript)"
description: "Golden ESLint flat config (eslint.config.mjs) combining @eslint/js, typescript-eslint type-checked rules, and eslint-plugin-sonarjs to enforce the Weave complexity budget: cyclomatic <= 10, cognitive <= 15, function <= 50 lines, file <= 300 lines, params <= 5, nesting depth <= 4."
tags: [standards, patterns, linting, typescript]
timestamp: 2026-07-01
resource: docs/standards/patterns/linting/eslint-sonarjs-strict.md
topic: linting
stack: typescript
verification: "node v24.14.1 `node --check <tmp>.mjs` (ESM parse of the eslint.config.mjs block) — PASS 2026-07-01"
---

# Linting — ESLint Flat Config with typescript-eslint + SonarJS (typescript)

## Intent

The flat config (`eslint.config.mjs`) is the single enforcement point for the Weave
complexity budget (`complexity.md`, `linting.md`). It layers `@eslint/js` recommended,
`typescript-eslint` type-checked rules (so `any`-leaks and unsafe access are caught), and
`eslint-plugin-sonarjs` cognitive-complexity analysis, then pins the six hard budgets:
cyclomatic `<= 10`, cognitive `<= 15`, function `<= 50` lines, file `<= 300` lines, params
`<= 5`, nesting depth `<= 4`. A rule breach is `error` — it blocks the merge; a waiver needs a
`// eslint-disable-next-line <rule> -- weave: allow-complex reason="…"` comment logged to
`.claude/state/complexity-waivers.md`.

```js
// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        // Type-aware linting — required for the no-unsafe-* rules below.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- Weave complexity budget (complexity.md) — all `error`, all block merge ---
      complexity: ['error', 10], // cyclomatic <= 10
      'sonarjs/cognitive-complexity': ['error', 15], // cognitive <= 15
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 5],
      'max-depth': ['error', 4],

      // --- Strictness: never silently widen types ---
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',

      // --- SonarJS maintainability ---
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicate-string': ['warn', { threshold: 3 }],
    },
  },
  {
    // Config and generated output are exempt from the budget.
    ignores: ['.next/', 'node_modules/', 'coverage/', 'eslint.config.mjs'],
  },
);
```

**Why**

- Flat config composes as an array: `@eslint/js` recommended, then spread
  `tseslint.configs.recommendedTypeChecked` (spread because it is an array of configs), then
  the SonarJS flat preset, then the Weave override block. Later entries win, so the budget
  block overrides preset defaults.
- `projectService: true` + `tsconfigRootDir` turn on type-aware linting — the prerequisite for
  `no-floating-promises` and the `no-unsafe-*` family that keep `any` from leaking through I/O.
- Every budget rule is `error`, not `warn`: `complexity`/`max-*` come from ESLint core,
  `sonarjs/cognitive-complexity` from SonarJS. This is the exact set in `complexity.md` — no
  budget is left to a human eyeball.
- `no-unused-vars` ignores `^_` so intentionally-unused params (e.g. a handler's leading arg)
  do not force a waiver.

**Security**

- `no-explicit-any` + the type-checked preset stop untyped `any` from carrying unvalidated
  external data past a boundary — the lint-level complement to zod validation.
- `no-floating-promises` catches an un-awaited async call (e.g. a fire-and-forget audit or
  fetch) that could drop an error or a security-relevant write silently.
- Config is committed and reviewed; do not weaken a budget rule to `warn` or `off` globally —
  scope any exception to a single line with a logged `weave: allow-complex` reason.

**Anti-patterns**

- Legacy `.eslintrc.json` / `extends` — Weave is flat-config only (`eslint.config.*`).
- Forgetting to spread `tseslint.configs.recommendedTypeChecked` (it is an array) — passing it
  as a single object silently drops rules.
- Setting budgets to `warn` — a warning does not block merge, so the budget is not enforced.
- Omitting `projectService`/`tsconfigRootDir` — type-checked rules then error at load time or
  silently no-op.
- Blanket `/* eslint-disable */` at file top instead of a single-line waiver with a reason.
