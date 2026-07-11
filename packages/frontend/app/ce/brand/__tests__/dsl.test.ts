import { describe, expect, it } from "vitest";

import { ASSERTION_TYPES, composeAssertion, parseAssertion } from "../dsl";

// AC-004-02: the assertion field is a type-select + value, not free text --
// these are the pure compose/parse functions the VoiceRuleForm's type-select
// + value input round-trip through.
describe("assertion DSL", () => {
  it("composes a type and value into a single assertion string", () => {
    expect(composeAssertion("regex", "^Do not.*$")).toBe("regex:^Do not.*$");
    expect(composeAssertion("forbidden-term", "synergy")).toBe("forbidden-term:synergy");
    expect(composeAssertion("max-length", "120")).toBe("max-length:120");
  });

  it("parses a composed assertion back into type and value", () => {
    expect(parseAssertion("forbidden-term:synergy")).toEqual({ type: "forbidden-term", value: "synergy" });
  });

  it("preserves colons inside the value (e.g. a regex containing ':')", () => {
    expect(parseAssertion("regex:^https?://.*$")).toEqual({ type: "regex", value: "^https?://.*$" });
  });

  it("falls back to 'regex' for an unrecognised/legacy assertion string", () => {
    expect(parseAssertion("some free text")).toEqual({ type: "regex", value: "some free text" });
  });

  it("exposes the fixed type catalogue for the type-select", () => {
    expect(ASSERTION_TYPES).toEqual(["regex", "forbidden-term", "max-length"]);
  });
});
