import { describe, expect, it } from "vitest";

import { buildBrowseQuery, PAGE_SIZE } from "../build-browse-query";

describe("buildBrowseQuery", () => {
  it("should_intersect_search_and_kind_filter_predicates", () => {
    const query = buildBrowseQuery({ kindIri: "https://weave.io/ontology/Actor", searchTerm: "acme", page: 1 });
    expect(query).toContain('FILTER(CONTAINS(LCASE(?label), "acme"))');
    expect(query).toContain("FILTER(?kind = <https://weave.io/ontology/Actor>)");
    // both FILTERs live in the same WHERE block -> AND, never OR
    const whereBlock = query.split("WHERE {")[1] ?? "";
    expect(whereBlock).toMatch(/CONTAINS[\s\S]*\?kind = <https:\/\/weave\.io\/ontology\/Actor>/);
  });

  it("scopes the WHERE body in GRAPH ?g (backend 400s unscoped queries)", () => {
    const query = buildBrowseQuery({ kindIri: null, searchTerm: "", page: 1 });
    expect(query).toContain("GRAPH ?g {");
  });

  it("omits the kind filter when no chip is active", () => {
    const query = buildBrowseQuery({ kindIri: null, searchTerm: "", page: 1 });
    expect(query).not.toContain("?kind =");
  });

  it("paginates via LIMIT/OFFSET at PAGE_SIZE rows per page", () => {
    const page2 = buildBrowseQuery({ kindIri: null, searchTerm: "", page: 2 });
    expect(page2).toContain(`LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE}`);
  });
});
