import { describe, expect, it } from "vitest";

import { sanitizeSearchTerm } from "../sanitize-search-term";

describe("sanitizeSearchTerm", () => {
  it("returns an ordinary term unchanged", () => {
    expect(sanitizeSearchTerm("obligation")).toBe("obligation");
  });

  it("strips characters that could break out of a SPARQL string literal", () => {
    expect(sanitizeSearchTerm('term"); DROP <bad> {x} \\ ;')).toBe("term) DROP bad x  ");
  });
});
