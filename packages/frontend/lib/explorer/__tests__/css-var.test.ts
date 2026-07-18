import { describe, expect, it } from "vitest";

import { stripVarWrapper } from "../css-var";

describe("stripVarWrapper", () => {
  it("strips a var(...) wrapper down to the bare custom-property name", () => {
    expect(stripVarWrapper("var(--color-kind-process)")).toBe("--color-kind-process");
  });

  it("passes through a value that isn't a var(...) wrapper unchanged", () => {
    expect(stripVarWrapper("--color-kind-process")).toBe("--color-kind-process");
    expect(stripVarWrapper("#3B82F6")).toBe("#3B82F6");
  });
});
