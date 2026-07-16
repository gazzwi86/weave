import { NextResponse } from "next/server";

import { fetchUpstream, proxyJson, requireBearerToken } from "@/lib/onboarding/backend-proxy";

export const runtime = "nodejs";

/** ONB-TASK-009: verifies a hands-on exercise (SPARQL ASK over the caller's
 * sandbox graph) and records completion if satisfied. Idempotent — safe to
 * re-check. Proxies POST /api/onboarding/exercises/{id}/check. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const token = await requireBearerToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const upstream = await fetchUpstream(
    `/api/onboarding/exercises/${encodeURIComponent(id)}/check`,
    { method: "POST" },
    token
  );
  if (!upstream) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}
