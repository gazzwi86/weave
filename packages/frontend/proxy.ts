import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { PUBLIC_PATHS } from "@/lib/public-paths";

// Law 18: rate-limit auth-bearing endpoints. Shared across requests to this
// server instance -- see lib/rate-limit.ts for the single-process caveat.
const authRateLimitStore = new Map<string, number[]>();

function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for") ?? "unknown";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    const allowed = checkRateLimit(authRateLimitStore, clientKey(req), Date.now());
    return allowed
      ? NextResponse.next()
      : new NextResponse("Too Many Requests", { status: 429 });
  }

  const isAuthenticated = Boolean(req.auth) && !req.auth?.error;
  if (!PUBLIC_PATHS.has(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/auth/login", req.nextUrl.origin);
    // TASK-029: pathname alone dropped query strings on the redirect round
    // trip (embeddable routes like ge-canvas-preview carry state in the
    // query) -- preserve the full original path+search, not just pathname.
    loginUrl.searchParams.set("return_to", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// AC-2/AC-3: guards every page/route except Next's own static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
