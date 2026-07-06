/** Decodes the `role` claim from a Cognito-issued JWT payload.
 *
 * No signature verification is performed here -- this token never arrives
 * as client-supplied input; it is the `accessToken` already trusted via the
 * server-side Auth.js/Cognito OIDC exchange (see auth.ts). Decoding the
 * payload is only extracting a claim that is already trusted, not a new
 * trust boundary. Returns null for anything that isn't a well-formed JWT
 * carrying a string `role` claim (safe default -- no raw-IRI disclosure). */
export function getCognitoRoleClaim(jwt: string): string | null {
  const [, payloadSegment] = jwt.split(".");
  if (!payloadSegment) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf-8")) as Record<string, unknown>;
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}
