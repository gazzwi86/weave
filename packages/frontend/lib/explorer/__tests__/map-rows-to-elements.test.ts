import { describe, expect, it } from "vitest";

import { mapRowsToElements } from "../map-rows-to-elements";
import type { CytoscapeElement, GraphRow } from "../types";

function isEdge(element: CytoscapeElement): boolean {
  return element.data.source !== undefined;
}

describe("mapRowsToElements", () => {
  it("builds one node per distinct subject/object and one edge per row", () => {
    const rows: GraphRow[] = [
      {
        subject: "https://weave.dev/p/onboarding",
        predicate: "https://weave.dev/rel/produces",
        object: "https://weave.dev/d/customer-record",
        bpmo_kind: "Process",
        label: "Customer Onboarding",
      },
    ];

    const elements = mapRowsToElements(rows);
    const nodes = elements.filter((el) => !isEdge(el));
    const [edge, ...restEdges] = elements.filter(isEdge);

    expect(nodes).toHaveLength(2);
    expect(restEdges).toHaveLength(0);
    expect(edge?.data).toMatchObject({
      source: "https://weave.dev/p/onboarding",
      target: "https://weave.dev/d/customer-record",
    });
  });

  it("dedupes a node that appears as subject in one row and object in another", () => {
    const rows: GraphRow[] = [
      { subject: "urn:a", predicate: "urn:rel", object: "urn:b" },
      { subject: "urn:b", predicate: "urn:rel", object: "urn:c" },
    ];

    const elements = mapRowsToElements(rows);
    const nodes = elements.filter((el) => !isEdge(el));

    expect(nodes.map((n) => n.data.id).sort()).toEqual(["urn:a", "urn:b", "urn:c"]);
  });

  it("prefers skos_pref_label, then label, then never falls back to the raw IRI", () => {
    const row: GraphRow = {
      subject: "https://weave.dev/kind/Process_Onboarding",
      predicate: "urn:rel",
      object: "https://weave.dev/kind/Data_Asset",
      skos_pref_label: "Onboarding",
    };

    const elements = mapRowsToElements([row]);
    const subjectNode = elements.find((el) => el.data.id === row.subject);
    const objectNode = elements.find((el) => el.data.id === row.object);

    expect(subjectNode?.data.label).toBe("Onboarding");
    // No label/skos_pref_label supplied for the object -- must derive a
    // human label from the IRI's last segment, never the raw IRI itself.
    expect(objectNode?.data.label).toBe("Data Asset");
    expect(objectNode?.data.label).not.toContain("https://");
  });
});
