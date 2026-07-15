import { describe, expect, it } from "vitest";

import { getPrincipalIriClaim } from "../get-principal-iri-claim";

function fakeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.signature`;
}

// ADR-019: actor attribution reads the canonical principal IRI verbatim from
// the JWT `principal_iri` claim -- never re-derives it from `sub`.
describe("getPrincipalIriClaim", () => {
  it("returns the principal_iri claim verbatim", () => {
    expect(
      getPrincipalIriClaim(fakeJwt({ sub: "cognito-sub-1", principal_iri: "urn:weave:principal:user:cognito-sub-1" }))
    ).toBe("urn:weave:principal:user:cognito-sub-1");
  });

  it("returns null when the JWT carries no principal_iri claim at all (fail loud upstream)", () => {
    expect(getPrincipalIriClaim(fakeJwt({ sub: "cognito-sub-1" }))).toBeNull();
  });

  it("returns null for a malformed JWT instead of throwing", () => {
    expect(getPrincipalIriClaim("not-a-jwt")).toBeNull();
  });

  it("returns null when the principal_iri claim is not a string", () => {
    expect(getPrincipalIriClaim(fakeJwt({ principal_iri: 123 }))).toBeNull();
  });

  it("returns null (not a throw) when the payload segment is not valid base64/JSON", () => {
    expect(getPrincipalIriClaim("header.not-valid-base64url-json.signature")).toBeNull();
  });
});
