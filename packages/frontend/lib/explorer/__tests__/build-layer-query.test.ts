import { describe, expect, it } from "vitest";

import { buildLayerQuery } from "../build-layer-query";

// TASK-020 AC-6: one query per governed-content layer -- kind IRI and
// (governance only) the governedBy predicate are always caller-supplied,
// never literals in this file (invariants-explorer.md: predicates live in
// config, not query-builder code).
describe("buildLayerQuery", () => {
  const kindIri = "https://weave.io/ontology/Concept";

  it("selects members of the given kind, scoped to a GRAPH clause", () => {
    const query = buildLayerQuery(kindIri);

    expect(query).toContain("GRAPH ?g");
    expect(query).toContain(`<${kindIri}>`);
    expect(query).toContain("SELECT ?subject ?label ?governed_object");
  });

  it("adds an OPTIONAL governedBy clause when a predicate is supplied (governance layer)", () => {
    const predicate = "https://weave.io/ontology/governedBy";

    const query = buildLayerQuery(kindIri, predicate);

    expect(query).toContain(`<${predicate}>`);
    expect(query).toContain("?governed_object");
  });

  it("omits the governedBy clause entirely when no predicate is supplied", () => {
    const query = buildLayerQuery(kindIri);

    expect(query).not.toContain("governedBy");
  });

  it("rejects a non-absolute kind IRI", () => {
    expect(() => buildLayerQuery("not-an-iri")).toThrow();
  });

  it("rejects a non-absolute governedBy predicate", () => {
    expect(() => buildLayerQuery(kindIri, "not-an-iri")).toThrow();
  });
});
