// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

import { dumbComponentRule, appLayerBoundaryRule } from "./components/tooling/lint-import-boundary.ts";
import { tokenConformanceRule } from "./components/tooling/lint-tokens.ts";

const weavePlugin = {
  rules: {
    "token-conformance": tokenConformanceRule,
    "dumb-component-imports": dumbComponentRule,
    "app-layer-boundary": appLayerBoundaryRule,
  },
};

const eslintConfig = defineConfig([...nextVitals, ...nextTs, sonarjs.configs.recommended, {
  rules: {
    complexity: ["error", 10],
    "sonarjs/cognitive-complexity": ["error", 15],
    "max-lines-per-function": ["warn", { max: 50, skipBlankLines: true, skipComments: true }],
    "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
    "sonarjs/no-duplicate-string": ["warn", { threshold: 3 }],
    "sonarjs/no-identical-functions": "error",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
}, {
  // Design-system gate (TASK-026): scoped to the new atomic-design layers
  // only -- components/{ui,shell,explorer,dashboard,marketing} predate this
  // rule and carry their own pre-existing literals (e.g. Cytoscape canvas
  // geometry, which isn't a CSS token at all). Retrofitting them is a
  // separate, unscoped task, not this one.
  files: ["components/{atoms,molecules,organisms,templates,pages}/**/*.{ts,tsx}"],
  ignores: ["**/*.stories.tsx", "**/*.test.ts", "**/*.test.tsx"],
  plugins: { weave: weavePlugin },
  rules: {
    "weave/token-conformance": "error",
    "weave/dumb-component-imports": "error",
  },
}, {
  files: ["app/**/*.{ts,tsx}"],
  plugins: { weave: weavePlugin },
  rules: {
    "weave/app-layer-boundary": "error",
  },
}, // Override default ignores of eslint-config-next.
globalIgnores([
  // Default ignores of eslint-config-next:
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  // Throwaway spike harnesses: own package.json/node_modules, not part of the
  // production app -- see benchmarks/ge-oq01-spike/report.md (TASK-001).
  "benchmarks/**",
]), ...storybook.configs["flat/recommended"]]);

export default eslintConfig;
