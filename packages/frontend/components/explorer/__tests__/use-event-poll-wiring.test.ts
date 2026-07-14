import { describe, expect, it } from "vitest";

import { matchesDelta } from "../use-event-poll-wiring";

describe("matchesDelta", () => {
  it("matches a node whose own id is in the changed set", () => {
    expect(matchesDelta({ data: { id: "n1" } }, new Set(["n1"]))).toBe(true);
    expect(matchesDelta({ data: { id: "n2" } }, new Set(["n1"]))).toBe(false);
  });

  it("matches an edge touching a changed node at either end", () => {
    const edge = { data: { id: "e1", source: "n1", target: "n2" } };
    expect(matchesDelta(edge, new Set(["n1"]))).toBe(true);
    expect(matchesDelta(edge, new Set(["n2"]))).toBe(true);
    expect(matchesDelta(edge, new Set(["n3"]))).toBe(false);
  });
});
