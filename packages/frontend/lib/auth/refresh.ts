/**
 * Refresh-token rotation for the Auth.js JWT callback (ADR-001: 300s access
 * token TTL; refresh when fewer than 30s remain).
 */

/** Seconds before expiry at which a token is considered "near expiry". */
const REFRESH_THRESHOLD_SECONDS = 30;

export interface WeaveJWT {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // seconds since epoch
  error?: "RefreshTokenError";
}

export interface OidcTokenEndpointConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

/** True once fewer than `REFRESH_THRESHOLD_SECONDS` remain before `expiresAt`. */
export function shouldRefresh(expiresAt: number, nowMs: number = Date.now()): boolean {
  return expiresAt - nowMs / 1000 < REFRESH_THRESHOLD_SECONDS;
}

interface TokenEndpointResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/**
 * Exchange `token.refreshToken` for a new access token via the OIDC token
 * endpoint. Returns the token unchanged but flagged with
 * `error: "RefreshTokenError"` when there is no refresh token to use, or the
 * provider rejects it (expired/revoked) — callers (middleware) treat that
 * flag as "sign the user out".
 */
export async function refreshAccessToken(
  token: WeaveJWT,
  config: OidcTokenEndpointConfig
): Promise<WeaveJWT> {
  if (!token.refreshToken) {
    return { ...token, error: "RefreshTokenError" };
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    return { ...token, error: "RefreshTokenError" };
  }

  const body = (await response.json()) as TokenEndpointResponse;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? token.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + body.expires_in,
  };
}
