import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
const searchQuerySchema = z.object({
  q: z.string().max(200),
});

/** AC-2/3: proxies the palette's search to the backend's tenant-scoped
 * `GET /api/search`, attaching the caller's session bearer token. No
 * workspace_id is sent -- the backend falls back to the caller's active
 * session workspace (see routers/search.py's `_authorize_search`).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = searchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/api/search?q=${encodeURIComponent(parsed.data.q)}`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      }
    );
  } catch {
    // PR #13 finding (4): backend unreachable -- distinguishable from a
    // real empty-results response, never silently proxied as one.
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    // A non-JSON body (e.g. a gateway's HTML error page) can't be forwarded
    // as-is and must not crash `.json()` below.
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}
