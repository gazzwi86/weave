import { describe, expect, it } from "vitest";

import { buildGlossaryBrowseQuery } from "../build-browse-query";

describe("buildGlossaryBrowseQuery", () => {
  it("orders by prefLabel and limits to 50 rows (AC-002-03)", () => {
    const query = buildGlossaryBrowseQuery(1);
    expect(query).toMatch(/ORDER BY \?prefLabel/);
    expect(query).toMatch(/LIMIT 50/);
  });

  it("offsets by (page - 1) * 50 -- page-number pagination, not a bespoke cursor", () => {
    expect(buildGlossaryBrowseQuery(1)).toMatch(/OFFSET 0/);
    expect(buildGlossaryBrowseQuery(2)).toMatch(/OFFSET 50/);
    expect(buildGlossaryBrowseQuery(3)).toMatch(/OFFSET 100/);
  });

  it("selects broader/narrower targets as navigable chip data", () => {
    const query = buildGlossaryBrowseQuery(1);
    expect(query).toMatch(/skos:broader/);
    expect(query).toMatch(/skos:narrower/);
  });

  it("selects skos:definition so the definition column isn't always blank", () => {
    const query = buildGlossaryBrowseQuery(1);
    expect(query).toMatch(/SELECT[^]*\?definition/);
    expect(query).toMatch(/OPTIONAL\s*\{\s*\?iri skos:definition \?definition\s*\}/);
  });

  it("wraps the pattern in a GRAPH clause (CE-READ-1 requires GRAPH-scoped SELECT)", () => {
    expect(buildGlossaryBrowseQuery(1)).toMatch(/GRAPH\s+\?g\s*\{/);
  });
});
