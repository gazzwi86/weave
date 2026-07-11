import { describe, expect, it } from "vitest";

import { OQ09_PREDICATE_CLOSURE } from "../closure-config";
import { WEAVE_ONTOLOGY_NS } from "../map-rows-to-elements";

// TASK-028 AC-1: literal copy of the ADR-018 table. If this fails, the
// config drifted from the ADR -- amend the ADR first (spec-before-code),
// then update this test to match, then update closure-config.ts.
const ADR_018_TABLE: { predicate: string; orientation: "forward" | "inverse" }[] = [
  { predicate: "dependsOn", orientation: "forward" },
  { predicate: "runsOn", orientation: "forward" },
  { predicate: "accesses", orientation: "forward" },
  { predicate: "consumes", orientation: "forward" },
  { predicate: "triggeredBy", orientation: "forward" },
  { predicate: "hasStep", orientation: "forward" },
  { predicate: "hasField", orientation: "forward" },
  { predicate: "performedBy", orientation: "forward" },
  { predicate: "governedBy", orientation: "forward" },
  { predicate: "produces", orientation: "inverse" },
  { predicate: "realizes", orientation: "inverse" },
  { predicate: "servesGoal", orientation: "inverse" },
  { predicate: "partOf", orientation: "inverse" },
];

describe("OQ09_PREDICATE_CLOSURE (TASK-028 AC-1)", () => {
  it("should ship closure config identical to ADR-018 table (snapshot test)", () => {
    expect(OQ09_PREDICATE_CLOSURE).toEqual(
      ADR_018_TABLE.map((entry) => ({
        predicate: `${WEAVE_ONTOLOGY_NS}${entry.predicate}`,
        orientation: entry.orientation,
      })),
    );
  });

  it("has exactly 9 forward and 4 inverse entries", () => {
    const forward = OQ09_PREDICATE_CLOSURE.filter((e) => e.orientation === "forward");
    const inverse = OQ09_PREDICATE_CLOSURE.filter((e) => e.orientation === "inverse");
    expect(forward).toHaveLength(9);
    expect(inverse).toHaveLength(4);
  });

  it("every predicate is an absolute weave: ontology IRI, not a CURIE", () => {
    for (const entry of OQ09_PREDICATE_CLOSURE) {
      expect(entry.predicate.startsWith(WEAVE_ONTOLOGY_NS)).toBe(true);
    }
  });
});
