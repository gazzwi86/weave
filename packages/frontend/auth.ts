import NextAuth from "next-auth";
import Cognito from "next-auth/providers/cognito";

import { refreshAccessToken, shouldRefresh, type WeaveJWT } from "@/lib/auth/refresh";

// AC-2/AC-3: `Cognito` is next-auth's built-in OIDC provider -- it discovers
// the authorization/token/jwks endpoints from `issuer`, so pointing this at
// the mock OIDC provider in dev/test vs. a real Cognito user pool later is
// an env-var change only, never a code change.
const OIDC_ISSUER_URL = process.env.OIDC_ISSUER_URL ?? "http://localhost:9001";
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID ?? "weave-dev";
function requireClientSecret(): string {
  if (process.env.OIDC_CLIENT_SECRET) return process.env.OIDC_CLIENT_SECRET;
  if (process.env.NODE_ENV !== "production") return "dev-secret";
  throw new Error("OIDC_CLIENT_SECRET must be set in production");
}

const OIDC_CLIENT_SECRET = requireClientSecret();

// next-auth signs its session JWT with this. Same dev/prod split as the OIDC
// client secret above: a fixed throwaway in dev so `npm run dev` works with no
// env file, hard-required in production. Missing it here previously let the
// middleware `auth()` wrapper error and fail OPEN onto protected routes.
function requireAuthSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV !== "production") return "dev-only-insecure-auth-secret";
  throw new Error("AUTH_SECRET must be set in production");
}

function tokenEndpointConfig() {
  return {
    tokenUrl: `${OIDC_ISSUER_URL}/token`,
    clientId: OIDC_CLIENT_ID,
    clientSecret: OIDC_CLIENT_SECRET,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: requireAuthSecret(),
  providers: [
    Cognito({
      clientId: OIDC_CLIENT_ID,
      clientSecret: OIDC_CLIENT_SECRET,
      issuer: OIDC_ISSUER_URL,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      if (!token.expiresAt || !shouldRefresh(token.expiresAt)) {
        return token;
      }

      const current: WeaveJWT = {
        accessToken: token.accessToken ?? "",
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
      };
      const refreshed = await refreshAccessToken(current, tokenEndpointConfig());
      return {
        ...token,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
        error: refreshed.error,
      };
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});
