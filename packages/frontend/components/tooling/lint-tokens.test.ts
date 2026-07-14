import { describe, expect, it } from "vitest";

import { checkTokenConformance } from "./lint-tokens";

describe("test_token_lint_rejects_raw_literal", () => {
  it("flags a raw hex colour literal in a components file", () => {
    const violations = checkTokenConformance(
      "packages/frontend/components/atoms/Foo.tsx",
      'const style = "bg-[#ff0000]";'
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain("raw_token_value");
  });

  it("flags a raw px literal in a components file", () => {
    const violations = checkTokenConformance(
      "packages/frontend/components/atoms/Foo.tsx",
      'const style = "w-[16px]";'
    );
    expect(violations).toHaveLength(1);
  });

  it("flags a raw ms duration literal in a components file", () => {
    const violations = checkTokenConformance(
      "packages/frontend/components/atoms/Foo.tsx",
      'const style = "duration-[200ms]";'
    );
    expect(violations).toHaveLength(1);
  });

  it("flags a violation on an absolute path (real ESLint context.filename shape)", () => {
    const violations = checkTokenConformance(
      "/Users/dev/weave/packages/frontend/components/atoms/Foo.tsx",
      'const style = "bg-[#ff0000]";'
    );
    expect(violations).toHaveLength(1);
  });
});

describe("test_token_lint_passes_on_var_token", () => {
  it("passes when the value is a var(--token) reference", () => {
    const violations = checkTokenConformance(
      "packages/frontend/components/atoms/Foo.tsx",
      'const style = "bg-[var(--color-accent-primary)]";'
    );
    expect(violations).toHaveLength(0);
  });

  it("does not govern files outside components/**", () => {
    const violations = checkTokenConformance(
      "packages/frontend/app/page.tsx",
      'const style = "bg-[#ff0000]";'
    );
    expect(violations).toHaveLength(0);
  });

  it("exempts the token source file itself", () => {
    const violations = checkTokenConformance(
      "packages/frontend/app/globals.css",
      "--color-bg: #0a0e14;"
    );
    expect(violations).toHaveLength(0);
  });
});
