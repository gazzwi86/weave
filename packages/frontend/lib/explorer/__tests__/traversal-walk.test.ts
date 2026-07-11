import { describe, expect, it } from "vitest";

import { OQ09_PREDICATE_CLOSURE } from "../closure-config";
import { walkClosure, type TripleLike } from "../traversal-walk";

const NS = "https://weave.io/ontology/";
const dependsOn = `${NS}dependsOn`;
const produces = `${NS}produces`;

describe("walkClosure basics", () => {
  const triples: TripleLike[] = [
    { subject: "svc", predicate: dependsOn, object: "sys" },
    { subject: "proc", predicate: produces, object: "data" },
  ];

  it("dependency walk follows a forward-orientation predicate as stored", () => {
    expect(walkClosure(triples, OQ09_PREDICATE_CLOSURE, "dependency", "svc", 6)).toEqual(new Set(["sys"]));
  });

  it("dependency walk follows an inverse-orientation predicate reversed", () => {
    // produces is inverse: stored proc->data, normalised dependency reading is data depends on proc
    expect(walkClosure(triples, OQ09_PREDICATE_CLOSURE, "dependency", "data", 6)).toEqual(new Set(["proc"]));
  });

  it("impact walk is the mirror of dependency walk for the same edge", () => {
    expect(walkClosure(triples, OQ09_PREDICATE_CLOSURE, "impact", "sys", 6)).toEqual(new Set(["svc"]));
    expect(walkClosure(triples, OQ09_PREDICATE_CLOSURE, "impact", "proc", 6)).toEqual(new Set(["data"]));
  });

  it("never walks beyond the depth cap", () => {
    const chain: TripleLike[] = [
      { subject: "a", predicate: dependsOn, object: "b" },
      { subject: "b", predicate: dependsOn, object: "c" },
      { subject: "c", predicate: dependsOn, object: "d" },
    ];
    expect(walkClosure(chain, OQ09_PREDICATE_CLOSURE, "dependency", "a", 2)).toEqual(new Set(["b", "c"]));
  });
});
