import { describe, expect, it } from "vitest";

import { deriveProjectRole } from "./derive-role";

const CONTRIBUTORS = [
  { principal_iri: "urn:weave:principal:user:client", role: "editor" },
  { principal_iri: "urn:weave:principal:user:owner", role: "admin" },
];

describe("deriveProjectRole (TASK-015 AC-4)", () => {
  it("grants admin via a tenant-scope admin grant, overlaying any project role", () => {
    expect(deriveProjectRole("admin", "urn:weave:principal:user:client", CONTRIBUTORS)).toBe(
      "admin"
    );
  });

  it("reads the contributor row's role when no tenant overlay applies", () => {
    expect(deriveProjectRole("author", "urn:weave:principal:user:client", CONTRIBUTORS)).toBe(
      "editor"
    );
    expect(deriveProjectRole("author", "urn:weave:principal:user:owner", CONTRIBUTORS)).toBe(
      "admin"
    );
  });

  it("returns null (no access) when the caller is not a contributor and has no tenant overlay", () => {
    expect(deriveProjectRole("author", "urn:weave:principal:user:stranger", CONTRIBUTORS)).toBeNull();
  });

  it("returns null when the principal is unknown", () => {
    expect(deriveProjectRole("author", null, CONTRIBUTORS)).toBeNull();
  });
});
