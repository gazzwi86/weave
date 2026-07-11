import { beforeEach, describe, expect, it } from "vitest";

import { getAttribution, recordAttribution } from "../attribution";

// AC-004-03 (partial -- see use-brand-list.test.ts for the row-render half):
// per-item PROV attribution isn't queryable from the store (no per-entity
// prov:generated triple, see types.ts docstring), so this UI records it
// itself at the one moment it's actually knowable: create time.
describe("brand attribution store (localStorage)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null for an IRI with no recorded attribution", () => {
    expect(getAttribution("urn:weave:instances:brandstandard-1")).toBeNull();
  });

  it("round-trips a recorded attribution for its IRI", () => {
    recordAttribution("urn:weave:instances:brandstandard-1", {
      actorIri: "user@example.com",
      versionIri: "urn:weave:tenant:t:ws:w:v0.0.2",
      committedAt: "2026-07-11T00:00:00.000Z",
    });

    expect(getAttribution("urn:weave:instances:brandstandard-1")).toEqual({
      actorIri: "user@example.com",
      versionIri: "urn:weave:tenant:t:ws:w:v0.0.2",
      committedAt: "2026-07-11T00:00:00.000Z",
    });
  });

  it("keeps attributions for different IRIs independent", () => {
    recordAttribution("urn:weave:instances:a", {
      actorIri: "a@example.com",
      versionIri: "urn:v1",
      committedAt: "2026-07-11T00:00:00.000Z",
    });
    recordAttribution("urn:weave:instances:b", {
      actorIri: "b@example.com",
      versionIri: "urn:v2",
      committedAt: "2026-07-11T00:01:00.000Z",
    });

    expect(getAttribution("urn:weave:instances:a")?.actorIri).toBe("a@example.com");
    expect(getAttribution("urn:weave:instances:b")?.actorIri).toBe("b@example.com");
  });
});
