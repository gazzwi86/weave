import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
// `from` is either "latest" or a version IRI; `to` is always a version IRI.
const diffQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

/** Proxies CE-READ-1's `GET /api/ontology/diff?from=&to=` -- returned
 * as-is (`{added, removed, modified}`), attaching the caller's session
 * bearer token server-side. A 404 (e.g. no published baseline yet) is
 * passed through unchanged so the caller can degrade gracefully.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const parsed = diffQuerySchema.safeParse({
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  const upstreamUrl =
    `${backendUrl}/api/ontology/diff?` +
    `from=${encodeURIComponent(parsed.data.from)}&to=${encodeURIComponent(parsed.data.to)}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}
