import { describe, expect, it } from "vitest";

import { buildCantParseReply } from "../cant-parse-examples";

describe("buildCantParseReply", () => {
  it("names the specific ambiguity and appends example phrasings", () => {
    const reply = buildCantParseReply("I couldn't tell which kind you meant.", null);
    expect(reply).toContain("I couldn't tell which kind you meant.");
    expect(reply).toContain("Try:");
  });

  it("never repeats the exact same reply twice in one session (F-D12)", () => {
    const first = buildCantParseReply("I'm not sure what you mean.", null);
    const second = buildCantParseReply("I'm not sure what you mean.", first);
    expect(second).not.toBe(first);
    expect(second).toContain("I'm not sure what you mean.");
  });
});
