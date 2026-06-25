---
topic: linting
stack: ts
references:
  - docs/stack-equivalents.md
  - templates/standards/base/complexity.md
---

# ESLint — sonarjs strict config with Plugin Law E gates + waiver syntax

All Plugin Law E thresholds enforced. Waiver syntax shown at the bottom.
Uses ESLint 9 flat config format.

```js
// eslint.config.js  (ESLint 9 flat config)
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";
import importPlugin from "eslint-plugin-import";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  js.configs.recommended,

  // TypeScript files
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      sonarjs,
      import: importPlugin,
    },
    rules: {
      // -- TypeScript strict -------------------------------------------------
      ...tsPlugin.configs["strict-type-checked"].rules,
      ...tsPlugin.configs["stylistic-type-checked"].rules,

      // -- Plugin Law E: cyclomatic complexity (≤ 10) -----------------------
      "sonarjs/cyclomatic-complexity": ["error", { threshold: 10 }],

      // -- Plugin Law E: cognitive complexity (≤ 15) -------------------------
      "sonarjs/cognitive-complexity": ["error", 15],

      // -- Plugin Law E: function length (≤ 50 lines) ------------------------
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],

      // -- Plugin Law E: file length (≤ 300 lines) ---------------------------
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],

      // -- Plugin Law E: max parameters (≤ 5) --------------------------------
      "max-params": ["error", { max: 5 }],

      // -- Plugin Law E: max nesting depth (≤ 4) ----------------------------
      "max-depth": ["error", { max: 4 }],

      // -- SonarJS recommended (bug-pattern detection) -----------------------
      ...sonarjs.configs.recommended.rules,

      // -- Import ordering ---------------------------------------------------
      "import/order": ["warn", {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
        "newlines-between": "always",
        alphabetize: { order: "asc" },
      }],

      // -- Other quality rules -----------------------------------------------
      "no-console":          ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/explicit-function-return-type": "off",  // inferred is fine
    },
  },

  // Test files — relax some rules
  {
    files: ["**/*.{test,spec}.{ts,tsx}", "**/tests/**"],
    rules: {
      "max-lines-per-function": ["error", { max: 100, skipBlankLines: true, skipComments: true }],
      "max-lines":              ["error", { max: 500 }],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
```

```ts
// -- Waiver syntax (Plugin Law E) ------------------------------------------

// Single-line disable with mandatory reason string:
// eslint-disable-next-line sonarjs/cognitive-complexity -- weave: allow-complex reason="parser table for legacy wire format; unrolling hurts readability"
function parseLegacyPayload(input: string): ParsedResult {
  // complex but justified body
  return {} as ParsedResult;
}

// Multi-line disable (use sparingly — prefer refactoring):
/* eslint-disable sonarjs/cyclomatic-complexity -- weave: allow-complex reason="state-machine transition table; 11 arms by design" */
function transition(state: State, event: Event): State {
  switch (state) {
    // ...11 arms
    default: return state;
  }
}
/* eslint-enable sonarjs/cyclomatic-complexity */
```

```bash
# Install
pnpm add -D eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser \
              eslint-plugin-sonarjs eslint-plugin-import

# Run
pnpm eslint . --max-warnings 0
```

**Why:** `--max-warnings 0` turns warnings into failures in CI — no warning
creep. Separate test overrides let test files be longer without disabling
production guards.
