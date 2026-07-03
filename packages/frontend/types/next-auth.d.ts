import type { DefaultSession } from "next-auth";

// AC-3: session/JWT carry the backend access token (for calling
// `/api/whoami` etc.) plus a refresh-failure flag the UI can react to.
declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    error?: "RefreshTokenError";
  }
}

// ponytail: augmenting "next-auth/jwt" doesn't merge -- it's a pure
// `export * from "@auth/core/jwt"` re-export, so the real interface lives
// at "@auth/core/jwt" and that's the module TS declaration merging needs.
declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: "RefreshTokenError";
  }
}
