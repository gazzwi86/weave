import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
const listQuerySchema = z.object({
  unread: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
});

type ListQuery = z.infer<typeof listQuerySchema>;

function parseListQuery(request: NextRequest): ListQuery | null {
  const parsed = listQuerySchema.safeParse({
    unread: request.nextUrl.searchParams.get("unread") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    per_page: request.nextUrl.searchParams.get("per_page") ?? undefined,
  });
  return parsed.success ? parsed.data : null;
}

function backendNotificationsUrl(query: ListQuery): string {
  const backendUrl = backendApiUrl();
  const params = new URLSearchParams({
    unread: query.unread ?? "false",
    page: String(query.page),
    per_page: String(query.per_page),
  });
  return `${backendUrl}/api/notifications?${params.toString()}`;
}

/** AC-2: proxies the notification centre badge/panel to the backend's
 * per-user, tenant-scoped `GET /api/notifications`, attaching the caller's
 * session bearer token.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const query = parseListQuery(request);
  if (!query) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(backendNotificationsUrl(query), {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    // Backend unreachable -- distinguishable from a real empty-results
    // response, never silently proxied as one (same as api/search/route.ts).
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}
