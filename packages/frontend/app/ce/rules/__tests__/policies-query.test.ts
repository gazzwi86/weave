import { describe, expect, it } from "vitest";

import { policiesQuery, toPolicyRow } from "../policies-query";

describe("policiesQuery", () => {
  it("selects weave:Policy individuals with label + iri, paginated", () => {
    const query = policiesQuery(0);
    expect(query).toContain("weave:Policy");
    expect(query).toContain("LIMIT 51 OFFSET 0");
  });

  it("offsets by page", () => {
    expect(policiesQuery(2)).toContain("OFFSET 100");
  });
});

describe("toPolicyRow", () => {
  it("maps a sparql row to a PolicyRow", () => {
    expect(toPolicyRow({ s: "urn:weave:instances:policy-1", label: "Vendor risk policy" })).toEqual({
      iri: "urn:weave:instances:policy-1",
      label: "Vendor risk policy",
    });
  });

  it("falls back to the local name when no label is bound", () => {
    expect(toPolicyRow({ s: "urn:weave:instances:policy-1" })).toEqual({
      iri: "urn:weave:instances:policy-1",
      label: "policy-1",
    });
  });
});
