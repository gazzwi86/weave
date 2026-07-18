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

  it("falls back to the IRI's last segment when no label triple exists for a node", () => {
    const row: GraphRow = {
      subject: "https://weave.dev/kind/Process_Onboarding",
      predicate: "urn:rel",
      object: "https://weave.dev/kind/Data_Asset",
    };

    const elements = mapRowsToElements([row]);
    const objectNode = elements.find((el) => el.data.id === row.object);

    expect(objectNode?.data.label).toBe("Data Asset");
    expect(objectNode?.data.label).not.toContain("https://");
  });

  // ADR-005 #1/#2 (backend rdf/patterns.py): the real label predicate the
  // engine writes is `weave:label` -- a literal-object row, same shape as
  // any other triple, not a joined-in `label` column. A raw machine IRI
  // like `field-f4ad78ae...` only ever gets a human label this way.
  it("applies a weave:label triple to the subject node's label, creating no literal node/edge", () => {
    const rows: GraphRow[] = [
      { subject: "field-f4ad78ae", predicate: "urn:rel", object: "urn:other" },
      { subject: "field-f4ad78ae", predicate: "https://weave.io/ontology/label", object: "Stock SKU" },
    ];

    const elements = mapRowsToElements(rows);
    const nodes = elements.filter((el) => !isEdge(el));
    const edges = elements.filter(isEdge);
    const subjectNode = nodes.find((el) => el.data.id === "field-f4ad78ae");

    expect(subjectNode?.data.label).toBe("Stock SKU");
    // The literal "Stock SKU" must never become its own node or edge.
    expect(nodes.find((el) => el.data.id === "Stock SKU")).toBeUndefined();
    expect(edges).toHaveLength(1);
  });

  // Glossary/Concept terms (hammerbarn_seed/content.py) use skos:prefLabel
  // instead of weave:label -- same literal-row shape, same handling.
  it("applies a skos:prefLabel triple to the subject node's label", () => {
    const rows: GraphRow[] = [
      {
        subject: "concept-active",
        predicate: "http://www.w3.org/2004/02/skos/core#prefLabel",
        object: "Active",
      },
    ];

    const elements = mapRowsToElements(rows);
    const nodes = elements.filter((el) => !isEdge(el));

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.data.label).toBe("Active");
  });

  it("a label triple arriving before the entity's other triples still labels the node once created", () => {
    const rows: GraphRow[] = [
      { subject: "field-f4ad78ae", predicate: "https://weave.io/ontology/label", object: "Stock SKU" },
      { subject: "field-f4ad78ae", predicate: "urn:rel", object: "urn:other" },
    ];

    const elements = mapRowsToElements(rows);
    const subjectNode = elements.find((el) => el.data.id === "field-f4ad78ae");

    expect(subjectNode?.data.label).toBe("Stock SKU");
  });
});
