import { describe, expect, it } from "vitest";

import { toBpmoKind, toEdgeRows } from "../inspector-view";

describe("toBpmoKind", () => {
  it("normalises a known kind (any case) to the KindChip union", () => {
    expect(toBpmoKind("Process")).toBe("process");
    expect(toBpmoKind("ACTIVITY")).toBe("activity");
  });

  it("returns null for an unrecognised kind, so callers fall back to plain text", () => {
    expect(toBpmoKind("SomeExtensionKind")).toBeNull();
  });

  it("returns null when the kind is absent (loading/error panel states)", () => {
    expect(toBpmoKind(undefined)).toBeNull();
  });
});

describe("toEdgeRows", () => {
  const neighbours = [
    {
      iri: "https://weave.example/entity/invoice-1",
      label: "Invoice 1",
      bpmoKind: "DataAsset",
      edgePredicate: "https://weave.example/ontology/bpmo#relatesTo",
      edgeDirection: "outgoing" as const,
    },
    {
      iri: "https://weave.example/entity/team-a",
      label: "Team A",
      bpmoKind: "Actor",
      edgePredicate: "https://weave.example/ontology/bpmo#performedBy",
      edgeDirection: "incoming" as const,
    },
  ];

  it("maps each neighbour to a clickable edge row with a humanised predicate label, never a raw IRI", () => {
    const rows = toEdgeRows(neighbours);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      predicateLabel: "relatesTo",
      targetLabel: "Invoice 1",
      targetIri: "https://weave.example/entity/invoice-1",
      direction: "outgoing",
    });
    expect(rows[1]).toMatchObject({ predicateLabel: "performedBy", targetLabel: "Team A", direction: "incoming" });
    for (const row of rows) expect(row.predicateLabel).not.toMatch(/^https?:\/\//);
  });

  it("gives every row a unique id even when two neighbours share a predicate", () => {
    const sameKind = [neighbours[0]!, { ...neighbours[0]!, iri: "https://weave.example/entity/invoice-2" }];
    const rows = toEdgeRows(sameKind);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
  });

  it("returns an empty list for a node with no neighbours", () => {
    expect(toEdgeRows([])).toEqual([]);
  });
});
