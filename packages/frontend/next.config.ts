import path from "node:path";

import type { NextConfig } from "next";

// Law 18: mandatory at scaffold time. Values are the standard stanza from
// docs/standards/code-style.md "Security headers", CSP connect-src trimmed
// to our own API origin (no Stripe/third-party checkout in this project).
//
// Turbopack/React dev mode compiles using dynamic code evaluation; the
// production build never does. So 'unsafe-eval' is added to script-src in
// development ONLY -- the shipped prod CSP is unchanged (and is what ui_verify
// measures via the prod build). Without this, `npm run dev` dies on an
// "unsafe-eval is not supported" CSP error.
const isProd = process.env.NODE_ENV === "production";
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`,
  },
];

const nextConfig: NextConfig = {
  // change-viz.tsx imports ../../../shared/widget-compat.json (single
  // shared compat matrix, AC-6) -- outside this package's root. Turbopack
  // (default bundler) resolves monorepo-external imports once it knows the
  // workspace root, so point it at packages/ rather than forcing webpack
  // app-wide (see git history: reverted app-wide --webpack workaround).
  turbopack: { root: path.join(__dirname, "..") },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // AC-6: bare /login insurance redirect (F-D25's literal URL) -- /auth/login
  // is the real, already-working sign-in route (TASK-002).
  async redirects() {
    return [{ source: "/login", destination: "/auth/login", permanent: false }];
  },
};

export default nextConfig;
