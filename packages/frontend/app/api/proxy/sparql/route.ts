import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
// This schema is also the AC-9 enforcement point: it only ever reads
// version/page from the querystring, so a `graph=` override (or anything
// else) can never reach the outgoing fetch below.
const sparqlQuerySchema = z.object({
  version: z.literal("latest"),
  page: z.coerce.number().int().min(0),
});

/** AC-1/AC-2: proxies one page of CE-READ-1's paginated SPARQL SELECT,
 * attaching the caller's session bearer token server-side. CE-READ-1 scopes
 * the named graph from the JWT's tenant claim -- this route never adds a
 * `graph=` override (AC-9). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const parsed = sparqlQuerySchema.safeParse({
    version: request.nextUrl.searchParams.get("version"),
    page: request.nextUrl.searchParams.get("page") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/api/sparql?version=${parsed.data.version}&page=${parsed.data.page}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" }
    );
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
