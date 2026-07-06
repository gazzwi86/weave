import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
// Both are optional -- CE-READ-1 applies its own defaults (page=1,
// per_page=50) when the caller omits them.
const versionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(200).optional(),
});

function buildForwardedParams(data: { page?: number; per_page?: number }): URLSearchParams {
  const params = new URLSearchParams();
  if (data.page !== undefined) params.set("page", String(data.page));
  if (data.per_page !== undefined) params.set("per_page", String(data.per_page));
  return params;
}

type UpstreamResult = { status: number; body: unknown } | null;

/** Fetches CE-READ-1's version list; null signals "treat as unavailable"
 * (network failure or a non-JSON upstream response), kept separate from
 * GET so the caller has one branch to handle instead of nesting try/catch
 * and content-type checks inline (keeps GET's complexity within budget). */
async function fetchUpstreamVersions(url: string, token: string): Promise<UpstreamResult> {
  let upstream: Response;
  try {
    upstream = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return null;
  }
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return { status: upstream.status, body: (await upstream.json()) as unknown };
}

/** Proxies CE-READ-1's `GET /api/ontology/versions` -- the version list is
 * returned as-is (no reshaping needed), attaching the caller's session
 * bearer token server-side. Drafts-visible-to-author-only is enforced by
 * the backend, not this route.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const parsed = versionsQuerySchema.safeParse({
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    per_page: request.nextUrl.searchParams.get("per_page") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  const forwardedParams = buildForwardedParams(parsed.data);
  const result = await fetchUpstreamVersions(
    `${backendUrl}/api/ontology/versions?${forwardedParams.toString()}`,
    session.accessToken
  );
  if (result === null) {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
  return NextResponse.json(result.body, { status: result.status });
}
