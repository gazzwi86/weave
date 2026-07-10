import { describe, expect, it } from "vitest";

import { OQ09_PREDICATE_CLOSURE } from "../closure-config";
import { walkClosure, type TripleLike } from "../traversal-walk";

const NS = "https://weave.io/ontology/";
const hasField = `${NS}hasField`;
const consumes = `${NS}consumes`;
const governedBy = `${NS}governedBy`;
const produces = `${NS}produces`;
const partOf = `${NS}partOf`;

// TASK-028 AC-6 / brief's "External" fixture: Policy<-governedBy-Process
// -consumes->DataAsset-hasField->Field, plus an inverse-orientation
// predicate (produces) and a second inverse predicate (partOf) so the
// fixture exercises both forward and inverse closure entries -- stored
// triples exactly as ADR-018's "Stored direction (CE)" column specifies.
const FIXTURE: TripleLike[] = [
  { subject: "urn:Process1", predicate: governedBy, object: "urn:Policy1" },
  { subject: "urn:Process1", predicate: consumes, object: "urn:DataAsset1" },
  { subject: "urn:DataAsset1", predicate: hasField, object: "urn:Field1" },
  { subject: "urn:Process1", predicate: produces, object: "urn:DataAsset2" },
  { subject: "urn:Field1", predicate: partOf, object: "urn:DataAsset1" },
];

const NODES = [
  "urn:Process1",
  "urn:Policy1",
  "urn:DataAsset1",
  "urn:Field1",
  "urn:DataAsset2",
];

const DEPTH_CAP = 6;

describe("test_impact_dependency_mirror_consistency (TASK-028 AC-6)", () => {
  it("Field change reaches consuming Process via hasField inverse-walk + consumes (named brief example)", () => {
    const impactOfField = walkClosure(FIXTURE, OQ09_PREDICATE_CLOSURE, "impact", "urn:Field1", DEPTH_CAP);
    expect(impactOfField.has("urn:DataAsset1")).toBe(true);
    expect(impactOfField.has("urn:Process1")).toBe(true);
  });

  it("Policy change reaches the governed Process (named brief example)", () => {
    const impactOfPolicy = walkClosure(FIXTURE, OQ09_PREDICATE_CLOSURE, "impact", "urn:Policy1", DEPTH_CAP);
    expect(impactOfPolicy.has("urn:Process1")).toBe(true);
  });

  it("impact(A) contains B iff dependency(B) contains A, for every pair in the fixture", () => {
    for (const a of NODES) {
      const impactOfA = walkClosure(FIXTURE, OQ09_PREDICATE_CLOSURE, "impact", a, DEPTH_CAP);
      for (const b of NODES) {
        if (a === b) continue;
        const dependencyOfB = walkClosure(FIXTURE, OQ09_PREDICATE_CLOSURE, "dependency", b, DEPTH_CAP);
        expect(impactOfA.has(b)).toBe(dependencyOfB.has(a));
      }
    }
  });
});
