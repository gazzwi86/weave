import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
// Mirrors weave_backend.routers.sparql's GET params (version-pinned reads --
// CE-TASK-007 AC-007-09/-10/-11/-12 -- distinct from the un-pinned POST
// /api/sparql CE-003 shipped for the active-workspace write path).
const sparqlQuerySchema = z.object({
  query: z.string().min(1).optional(),
  pattern: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  workspace_id: z.string().min(1).optional(),
});

/** Parses+validates the incoming search params (Law 13), returning `null`
 * when invalid or when neither `query` nor `pattern` is present -- split
 * out of `GET` to keep it under the complexity budget (Law E).
 */
function parseSparqlParams(request: NextRequest): URLSearchParams | null {
  const params = request.nextUrl.searchParams;
  const parsed = sparqlQuerySchema.safeParse({
    query: params.get("query") ?? undefined,
    pattern: params.get("pattern") ?? undefined,
    version: params.get("version") ?? undefined,
    page: params.get("page") ?? undefined,
    workspace_id: params.get("workspace_id") ?? undefined,
  });
  if (!parsed.success || (!parsed.data.query && !parsed.data.pattern)) {
    return null;
  }
  return new URLSearchParams(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined) as [string, string][]
  );
}

/** CE-TASK-007 AC-007-09: proxies the SPARQL editor's execute action (and
 * the coverage_gap "run report" action, via `pattern=`) to the backend's
 * `GET /api/sparql`, attaching the caller's session bearer token.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const upstreamParams = parseSparqlParams(request);
  if (upstreamParams === null) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/sparql?${upstreamParams.toString()}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}
