import { describe, expect, it } from "vitest";

import { buildDepthCappedPath, buildTraversalPath } from "../build-traversal-path";

const CLOSURE = [
  { predicate: "https://weave.io/ontology/dependsOn", orientation: "forward" as const },
  { predicate: "https://weave.io/ontology/produces", orientation: "inverse" as const },
];

describe("buildTraversalPath (TASK-028 AC-6, shared composer, direction arg)", () => {
  it("dependency walk: forward entries as-is, inverse entries get ^", () => {
    expect(buildTraversalPath(CLOSURE, "dependency")).toBe(
      "<https://weave.io/ontology/dependsOn>|^<https://weave.io/ontology/produces>",
    );
  });

  it("impact walk: forward entries get ^, inverse entries as-is -- the mirror of dependency", () => {
    expect(buildTraversalPath(CLOSURE, "impact")).toBe(
      "^<https://weave.io/ontology/dependsOn>|<https://weave.io/ontology/produces>",
    );
  });

  it("should compose dependency and impact property paths as mirrored alternations from config", () => {
    const dependency = buildTraversalPath(CLOSURE, "dependency");
    const impact = buildTraversalPath(CLOSURE, "impact");
    // every leg flips its ^ prefix between the two directions, in place
    const legs = dependency.split("|");
    const impactLegs = impact.split("|");
    legs.forEach((leg, i) => {
      const flipped = leg.startsWith("^") ? leg.slice(1) : `^${leg}`;
      expect(impactLegs[i]).toBe(flipped);
    });
  });

  it("rejects a non-absolute predicate IRI (Law 13)", () => {
    expect(() => buildTraversalPath([{ predicate: "notAnIri", orientation: "forward" }], "dependency")).toThrow();
  });
});

describe("buildDepthCappedPath (FR-010: SPARQL property paths can't bound natively)", () => {
  it("chains N optional single-hop segments for a depth cap of N", () => {
    const alternation = buildTraversalPath(CLOSURE, "dependency");
    expect(buildDepthCappedPath(CLOSURE, "dependency", 3)).toBe(`(${alternation})?/(${alternation})?/(${alternation})?`);
  });

  it("depth cap of 1 is a single optional hop", () => {
    expect(buildDepthCappedPath(CLOSURE, "dependency", 1)).toBe(`(${buildTraversalPath(CLOSURE, "dependency")})?`);
  });
});
