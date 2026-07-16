import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: query params/body are untrusted input -- validated via zod, never
// cast. Mirrors app/api/proxy/sparql/route.ts's pattern.
const graphIdQuerySchema = z.object({ graph_id: z.string().min(1) });

const savePositionBodySchema = z.object({
  graph_id: z.string().min(1),
  node_iri: z.string().min(1),
  position_x: z.number(),
  position_y: z.number(),
});

function backendUrl(): string {
  return backendApiUrl();
}

/** Forwards the backend's response verbatim, except for the two failure
 * modes that must never leak raw/garbage bodies to the client: a network
 * failure (no response at all) and a non-JSON upstream body (e.g. a gateway
 * error page) -- both collapse to the same 503 `store_unavailable` shape
 * used by app/api/proxy/sparql/route.ts. A 204 (POST/DELETE success) has no
 * body, so it's returned as-is without attempting `.json()`. */
async function forward(upstream: Promise<Response>): Promise<NextResponse> {
  let response: Response;
  try {
    response = await upstream;
  } catch {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
  const body = (await response.json()) as unknown;
  return NextResponse.json(body, { status: response.status });
}

function unauthorised(): NextResponse {
  return NextResponse.json({ error: "unauthorised" }, { status: 401 });
}

/** AC-3/AC-5: proxies the saved-layout read, attaching the caller's session
 * bearer token server-side. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return unauthorised();

  const parsed = graphIdQuerySchema.safeParse({ graph_id: request.nextUrl.searchParams.get("graph_id") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "missing_field", field: "graph_id" }, { status: 422 });
  }

  return forward(
    fetch(`${backendUrl()}/api/layout/positions?graph_id=${encodeURIComponent(parsed.data.graph_id)}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    })
  );
}

/** AC-1: proxies a single dragged node's position save. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return unauthorised();

  const parsed = savePositionBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  return forward(
    fetch(`${backendUrl()}/api/layout/positions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    })
  );
}

/** AC-4: proxies the reset-layout action. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return unauthorised();

  const parsed = graphIdQuerySchema.safeParse({ graph_id: request.nextUrl.searchParams.get("graph_id") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "missing_field", field: "graph_id" }, { status: 422 });
  }

  return forward(
    fetch(`${backendUrl()}/api/layout/positions?graph_id=${encodeURIComponent(parsed.data.graph_id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    })
  );
}
