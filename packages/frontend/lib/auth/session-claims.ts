/** Display-only claims for the app shell (tenant chip + RBAC nav split).
 *
 * Same trust posture as lib/explorer/get-cognito-role-claim.ts: the token is
 * the server-side session's accessToken, already trusted via the OIDC
 * exchange — decoding is claim extraction, not a new trust boundary. The
 * backend enforces real RBAC on every API call; this only shapes the nav.
 */

export interface SessionClaims {
  role: string | null;
  tenantId: string | null;
}

function decodePayload(jwt: string): Record<string, unknown> | null {
  const [, payloadSegment] = jwt.split(".");
  if (!payloadSegment) return null;
  try {
    return JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf-8")
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getSessionClaims(jwt: string | undefined): SessionClaims {
  const payload = jwt ? decodePayload(jwt) : null;
  if (!payload) return { role: null, tenantId: null };

  const tenantId = typeof payload.tenant_id === "string" ? payload.tenant_id : null;
  if (typeof payload.role === "string") return { role: payload.role, tenantId };

  // ponytail: mock-oidc issues no role claim and the backend has no
  // "my workspace role" endpoint yet — map the two seeded demo logins by
  // sub (seed_demo.py: admin -> admin, client -> author). Replace with a
  // real membership lookup when one exists.
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) return { role: null, tenantId };
  return { role: sub === "admin" ? "admin" : "author", tenantId };
}
