import { describe, expect, it } from "vitest";

import { getSessionClaims } from "./session-claims";

function makeJwt(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${body}.sig`;
}

describe("getSessionClaims", () => {
  it("prefers an explicit role claim", () => {
    const jwt = makeJwt({ sub: "client", tenant_id: "acme-corp", role: "compliance" });
    expect(getSessionClaims(jwt)).toEqual({ role: "compliance", tenantId: "acme-corp" });
  });

  it("maps the seeded demo subs when no role claim exists", () => {
    expect(getSessionClaims(makeJwt({ sub: "admin", tenant_id: "acme-corp" }))).toEqual({
      role: "admin",
      tenantId: "acme-corp",
    });
    expect(getSessionClaims(makeJwt({ sub: "client", tenant_id: "acme-corp" }))).toEqual({
      role: "author",
      tenantId: "acme-corp",
    });
  });

  it("returns nulls for missing or malformed tokens", () => {
    expect(getSessionClaims(undefined)).toEqual({ role: null, tenantId: null });
    expect(getSessionClaims("not-a-jwt")).toEqual({ role: null, tenantId: null });
  });
});
