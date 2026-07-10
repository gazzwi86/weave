import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import { appLayerBoundaryRule, dumbComponentRule } from "./lint-import-boundary";
import { tokenConformanceRule } from "./lint-tokens";

/**
 * Proves the ESLint rule *objects* (not just the pure check fns) fire when
 * run through ESLint's real Linter with realistic absolute filenames -- the
 * shape `context.filename` actually has in `npm run lint` (see ADV note:
 * a rule keyed on a relative-path prefix silently no-ops on absolute paths).
 */
// Real, cwd-anchored absolute paths -- ESLint's flat-config `files` glob
// matches relative-to-cwd, so a fabricated path outside the repo tree
// (e.g. "/Users/dev/weave/...") never matches and the rule silently no-ops.
// Anchoring to process.cwd() reproduces the exact context.filename shape
// `npm run lint` hands the rule.
const ROOT = process.cwd();

function lint(relativePath: string, code: string, ruleId: string, rule: unknown) {
  const linter = new Linter({ cwd: ROOT } as never);
  return linter.verify(code, {
    files: ["**/*.tsx"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { weave: { rules: { [ruleId]: rule } } },
    rules: { [`weave/${ruleId}`]: "error" },
  } as never, `${ROOT}/${relativePath}`);
}

describe("wired ESLint rules fire on absolute paths", () => {
  it("token-conformance reports a raw hex literal", () => {
    const messages = lint(
      "components/atoms/Foo.tsx",
      'const c = "bg-[#ff0000]";',
      "token-conformance",
      tokenConformanceRule
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain("raw_token_value");
  });

  it("token-conformance is silent on var(--token) usage", () => {
    const messages = lint(
      "components/atoms/Foo.tsx",
      'const c = "bg-[var(--color-accent-primary)]";',
      "token-conformance",
      tokenConformanceRule
    );
    expect(messages).toHaveLength(0);
  });

  it("dumb-component-imports reports a data-fetch import in an organism", () => {
    const messages = lint(
      "components/organisms/NavRail.tsx",
      'import useSWR from "swr";',
      "dumb-component-imports",
      dumbComponentRule
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain("dumb_component_data_fetch_import");
  });

  it("app-layer-boundary reports app/** importing a raw organism", () => {
    const messages = lint(
      "app/dashboard/page.tsx",
      'import { NavRail } from "@/components/organisms/NavRail";',
      "app-layer-boundary",
      appLayerBoundaryRule
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain("app_layer_boundary");
  });
});
