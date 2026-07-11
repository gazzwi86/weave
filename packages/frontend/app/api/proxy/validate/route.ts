import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
const validateQuerySchema = z.object({
  version: z.string().min(1).optional(),
  run: z.enum(["true", "false"]).optional(),
});

function buildForwardedParams(data: { version?: string; run?: string }): URLSearchParams {
  const params = new URLSearchParams();
  if (data.version !== undefined) params.set("version", data.version);
  if (data.run !== undefined) params.set("run", data.run);
  return params;
}

type UpstreamResult = { status: number; body: unknown } | null;

/** Fetches CE-TASK-006's `GET /api/validate`; null signals "treat as
 * unavailable" (network failure or a non-JSON upstream response), kept
 * separate from GET so the caller has one branch to handle. */
async function fetchUpstreamReport(url: string, token: string): Promise<UpstreamResult> {
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

/** Proxies `GET /api/validate` (AC-006-01/-02/-03/-04/-05) -- the report
 * (or the honest `{"pending": true}` shape) is returned as-is, attaching
 * the caller's session bearer token server-side.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const parsed = validateQuerySchema.safeParse({
    version: request.nextUrl.searchParams.get("version") ?? undefined,
    run: request.nextUrl.searchParams.get("run") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  const forwardedParams = buildForwardedParams(parsed.data);
  const result = await fetchUpstreamReport(
    `${backendUrl}/api/validate?${forwardedParams.toString()}`,
    session.accessToken
  );
  if (result === null) {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
  return NextResponse.json(result.body, { status: result.status });
}
