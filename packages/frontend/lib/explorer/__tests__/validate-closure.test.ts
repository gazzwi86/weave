import { describe, expect, it } from "vitest";

import { describeDrift, validateClosure } from "../validate-closure";

const CLOSURE = [
  { predicate: "https://weave.io/ontology/dependsOn", orientation: "forward" as const },
  { predicate: "https://weave.io/ontology/hasField", orientation: "forward" as const },
];

describe("validateClosure (TASK-028 AC-2)", () => {
  it("resolves clean when CE-READ-1 serves every closure predicate", () => {
    const result = validateClosure(CLOSURE, [
      { path: "https://weave.io/ontology/dependsOn" },
      { path: "https://weave.io/ontology/hasField" },
    ]);
    expect(result).toEqual({ ok: true, missing: [] });
  });

  // should disable traversal with named missing predicates when types
  // response lacks one -- invariants-explorer.md M2 delta
  it("test_closure_drift_guard_fails_loud", () => {
    const result = validateClosure(CLOSURE, [{ path: "https://weave.io/ontology/dependsOn" }]);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["https://weave.io/ontology/hasField"]);
  });

  it("should not fail drift guard when CE serves additional unknown predicates", () => {
    const result = validateClosure(CLOSURE, [
      { path: "https://weave.io/ontology/dependsOn" },
      { path: "https://weave.io/ontology/hasField" },
      { path: "https://weave.io/ontology/someBrandNewPredicate" },
    ]);
    expect(result).toEqual({ ok: true, missing: [] });
  });

  it("reports every missing predicate, not just the first", () => {
    const result = validateClosure(CLOSURE, []);
    expect(result.missing).toEqual(CLOSURE.map((e) => e.predicate));
  });
});

describe("describeDrift (TASK-028 AC-2)", () => {
  it("names every missing predicate in the loud banner message", () => {
    expect(describeDrift(["https://weave.io/ontology/hasField", "https://weave.io/ontology/partOf"])).toBe(
      "Ontology drift: https://weave.io/ontology/hasField, https://weave.io/ontology/partOf not served by CE",
    );
  });
});
