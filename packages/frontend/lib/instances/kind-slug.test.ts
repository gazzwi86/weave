import { describe, expect, it } from "vitest";

import { FALLBACK_KIND, kindIriToSlug } from "./kind-slug";

describe("kindIriToSlug", () => {
  it("should_map_kind_to_chip_colour_and_glyph_deterministically", () => {
    const a = kindIriToSlug("https://weave.io/ontology/Actor");
    const b = kindIriToSlug("https://weave.io/ontology/Actor");
    expect(a).toBe("actor");
    expect(a).toBe(b);
  });

  it("maps a hash-style IRI the same way as a slash-style one", () => {
    expect(kindIriToSlug("https://weave.io/ontology#Process")).toBe("process");
  });

  it("falls back to a default slug for an unknown extension kind instead of crashing", () => {
    expect(kindIriToSlug("https://client.example.com/ontology/CustomThing")).toBe(FALLBACK_KIND);
  });
});
