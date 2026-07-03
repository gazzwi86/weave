import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// robots.txt must stay reachable by unauthenticated crawlers -- Lighthouse's
// SEO audit scores 0 if a crawler gets redirected to the sign-in page instead.
const PUBLIC_PATHS = new Set(["/", "/auth/login", "/robots.txt"]);

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
    loginUrl.searchParams.set("return_to", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// AC-2/AC-3: guards every page/route except Next's own static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
