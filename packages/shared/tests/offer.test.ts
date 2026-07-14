import { describe, expect, it } from "vitest";
import { isOfferable } from "../onboarding/checks/offer";
import type { Anchor } from "../onboarding/anchors";

const registry: Record<string, Anchor> = {
  "a.one": { engine: "constitution", area: "constitution", phase: "m2", shipped: true, planted_by: "TASK-002" },
  "a.two": { engine: "constitution", area: "constitution", phase: "m2", shipped: false, planted_by: "TASK-002" },
};

describe("isOfferable (AC-001-05, per-anchor gating)", () => {
  it("offers a tour whose every anchor is shipped", () => {
    expect(isOfferable(["a.one"], registry)).toBe(true);
  });

  it("withholds a tour when any one of its anchors is not shipped", () => {
    expect(isOfferable(["a.one", "a.two"], registry)).toBe(false);
  });

  it("withholds a tour referencing an anchor missing from the registry", () => {
    expect(isOfferable(["a.one", "not-registered"], registry)).toBe(false);
  });

  it("is vacuously offerable for an overlay declaring zero anchors (edge case -- Array.every on [])", () => {
    // ponytail note for future readers, not an implementation change: `isOfferable([], registry)`
    // returns true because `[].every(...)` is vacuously true. An overlay config that forgets to
    // list its anchors would silently render unconditionally rather than fail closed. Documented
    // here as a known edge; TASK-002/003/004 authors must not ship a zero-anchor overlay.
    expect(isOfferable([], registry)).toBe(true);
  });
});
