/** Decodes the `principal_iri` claim from a Cognito-issued JWT payload
 * (ADR-019: canonical human/agent identity, minted by PLAT-IDENTITY-1 at
 * first login -- never the bare Cognito `sub`).
 *
 * No signature verification is performed here -- this token never arrives
 * as client-supplied input; it is the `accessToken` already trusted via the
 * server-side Auth.js/Cognito OIDC exchange (see auth.ts). Decoding the
 * payload is only extracting a claim that is already trusted, not a new
 * trust boundary. Mirrors get-cognito-role-claim.ts's decode shape.
 * Returns null for anything that isn't a well-formed JWT carrying a string
 * `principal_iri` claim -- callers fail the edit loud (401) on null,
 * per ADR-019: an edit is never committed with missing attribution. */
export function getPrincipalIriClaim(jwt: string): string | null {
  const [, payloadSegment] = jwt.split(".");
  if (!payloadSegment) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf-8")) as Record<string, unknown>;
    return typeof payload.principal_iri === "string" ? payload.principal_iri : null;
  } catch {
    return null;
  }
}
