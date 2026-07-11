import { describe, expect, it } from "vitest";

import { humaniseRelName } from "../humanise-rel-name";

const RELATIONSHIPS = [
  { path: "https://weave.example/ontology/bpmo#performedBy", name: "performed by" },
  { path: "https://weave.example/ontology/bpmo#governedBy", name: "" },
];

describe("humaniseRelName", () => {
  it("returns the CE types label for a known predicate (M1 IRI-hiding rule)", () => {
    expect(humaniseRelName("https://weave.example/ontology/bpmo#performedBy", RELATIONSHIPS)).toBe("performed by");
  });

  it("falls back to the IRI's local segment when the known entry has no name", () => {
    expect(humaniseRelName("https://weave.example/ontology/bpmo#governedBy", RELATIONSHIPS)).toBe("governedBy");
  });

  it("falls back to the IRI's local segment for a predicate absent from the types list, never the raw IRI", () => {
    const result = humaniseRelName("https://weave.example/ontology/bpmo#ownedBy", RELATIONSHIPS);
    expect(result).toBe("ownedBy");
    expect(result).not.toContain("https://");
  });

  it("falls back to the last path segment when there is no '#' fragment", () => {
    expect(humaniseRelName("https://weave.example/ontology/bpmo/ownedBy", [])).toBe("ownedBy");
  });
});
