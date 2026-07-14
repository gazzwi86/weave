import { describe, expect, it } from "vitest";

import { EXERCISES } from "../onboarding/content/exercises";

/** TASK-009: exercise completion signals must match the PRD exercise table
 * (onboarding.md E4-S1) verbatim -- CE-02/CE-03/CE-03b verify by SPARQL ASK,
 * GE-01/GE-02 verify by canvas/overlay state. */
function byId(id: string) {
  const exercise = EXERCISES.find((e) => e.exerciseId === id);
  if (!exercise) throw new Error(`missing exercise ${id}`);
  return exercise;
}

describe("EXERCISES completion signals (AC-009-03)", () => {
  it("CE-01 requires both entity-list and missing-property nav signals", () => {
    const ce01 = byId("CE-01");
    expect(ce01.completion.kind).toBe("nav_signal");
    if (ce01.completion.kind !== "nav_signal") throw new Error("unreachable");
    expect(ce01.completion.signal.split(",")).toEqual(
      expect.arrayContaining(["entity-list-viewed", "missing-property-viewed"]),
    );
  });

  it("CE-02 verifies via SPARQL ASK over the sandbox graph after the write commit", () => {
    const ce02 = byId("CE-02");
    expect(ce02.completion.kind).toBe("sparql_ask");
    if (ce02.completion.kind !== "sparql_ask") throw new Error("unreachable");
    expect(ce02.completion.ask).toMatch(/Outdoor Furniture/);
  });

  it("CE-03 (Technical-only) and CE-03b (Business) verify the same unowned-process ASK", () => {
    const ce03 = byId("CE-03");
    const ce03b = byId("CE-03b");
    expect(ce03.completion).toEqual(ce03b.completion);
    expect(ce03.paths).toEqual(["technical"]);
    expect(ce03b.paths).not.toContain("technical");
  });

  it("GE-01/GE-02 verify canvas/overlay state, not a nav signal", () => {
    expect(byId("GE-01").completion.kind).toBe("canvas_state");
    expect(byId("GE-02").completion.kind).toBe("canvas_state");
  });
});
