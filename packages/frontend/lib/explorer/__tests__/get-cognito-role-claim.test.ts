import { describe, expect, it } from "vitest";

import { getCognitoRoleClaim } from "../get-cognito-role-claim";

function fakeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.signature`;
}

// AC-2: raw-IRI disclosure must be decided from the server-side Cognito JWT
// claim, never a client-side flag.
describe("getCognitoRoleClaim", () => {
  it("returns 'ontologist' when the JWT payload carries that role claim", () => {
    expect(getCognitoRoleClaim(fakeJwt({ sub: "u1", role: "ontologist" }))).toBe("ontologist");
  });

  it("returns 'viewer' when the JWT payload carries that role claim", () => {
    expect(getCognitoRoleClaim(fakeJwt({ sub: "u1", role: "viewer" }))).toBe("viewer");
  });

  it("returns null when the JWT carries no role claim at all (safe default)", () => {
    expect(getCognitoRoleClaim(fakeJwt({ sub: "u1" }))).toBeNull();
  });

  it("returns null for a malformed JWT instead of throwing", () => {
    expect(getCognitoRoleClaim("not-a-jwt")).toBeNull();
  });

  it("returns null when the role claim is not a string", () => {
    expect(getCognitoRoleClaim(fakeJwt({ role: 123 }))).toBeNull();
  });
});
