import { describe, expect, it } from "vitest";

import { matchesSearchQuery } from "../search-filter";

// AC-5: nodes matching the query on label or entity-type label
// (case-insensitive substring) highlight; non-matching nodes dim.
describe("matchesSearchQuery", () => {
  it("matches a case-insensitive substring of the node label", () => {
    expect(matchesSearchQuery({ id: "n1", label: "Customer Onboarding" }, "onboard")).toBe(true);
    expect(matchesSearchQuery({ id: "n1", label: "Customer Onboarding" }, "ONBOARD")).toBe(true);
  });

  it("matches a case-insensitive substring of the entity-type (bpmoKind)", () => {
    expect(matchesSearchQuery({ id: "n1", label: "Onboarding", bpmoKind: "Process" }, "proc")).toBe(true);
  });

  it("does not match when the query is not a substring of label or bpmoKind", () => {
    expect(matchesSearchQuery({ id: "n1", label: "Onboarding", bpmoKind: "Process" }, "invoice")).toBe(false);
  });

  it("does not match when the node has neither label nor bpmoKind", () => {
    expect(matchesSearchQuery({ id: "n1" }, "onboard")).toBe(false);
  });
});
