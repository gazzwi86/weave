import { describe, expect, it } from "vitest";

import { normalizeUrn } from "./normalize-urn";

// BUG-06: a hard load hands useParams() a decoded segment, but a
// client-side <Link> navigation hands it back still percent-encoded --
// normalizing either input must land on the same raw value so
// `encodeURIComponent` downstream always single-encodes.
describe("normalizeUrn", () => {
  it("passes through a raw (already-decoded) URN unchanged", () => {
    expect(normalizeUrn("urn:weave:project:acme-corp:hv")).toBe("urn:weave:project:acme-corp:hv");
  });

  it("decodes an already percent-encoded URN (client-nav case)", () => {
    expect(normalizeUrn("urn%3Aweave%3Aproject%3Aacme-corp%3Ahv")).toBe(
      "urn:weave:project:acme-corp:hv"
    );
  });

  it("is idempotent -- decoding the result again is a no-op", () => {
    const once = normalizeUrn("urn%3Aweave%3Aproject%3Aacme-corp%3Ahv");
    expect(normalizeUrn(once)).toBe(once);
  });

  it("falls back to the original value on a malformed percent sequence", () => {
    expect(normalizeUrn("100%done")).toBe("100%done");
  });
});
