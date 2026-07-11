import { describe, expect, it } from "vitest";

import { buildGlossarySearchQuery } from "../build-search-query";

describe("buildGlossarySearchQuery", () => {
  it("matches case-insensitively across prefLabel, altLabel, and definition (AC-002-01)", () => {
    const query = buildGlossarySearchQuery("Invoice");
    expect(query).toMatch(/CONTAINS\(LCASE\(STR\(\?prefLabel\)\), LCASE\("invoice"\)\)/);
    expect(query).toMatch(/CONTAINS\(LCASE\(STR\(\?altLabel\)\), LCASE\("invoice"\)\)/);
    expect(query).toMatch(/CONTAINS\(LCASE\(STR\(\?definition\)\), LCASE\("invoice"\)\)/);
  });

  it("wraps the pattern in a GRAPH clause (CE-READ-1 requires GRAPH-scoped SELECT)", () => {
    expect(buildGlossarySearchQuery("invoice")).toMatch(/GRAPH\s+\?g\s*\{/);
  });

  it("selects iri, prefLabel, definition, and owlRole", () => {
    expect(buildGlossarySearchQuery("invoice")).toMatch(
      /SELECT\s+\?iri\s+\?prefLabel\s+\?definition\s+\?owlRole/
    );
  });

  it("sanitizes an unsafe search term before interpolating it", () => {
    const query = buildGlossarySearchQuery('invoice"); DROP');
    expect(query).toContain('LCASE("invoice) drop")');
  });
});
