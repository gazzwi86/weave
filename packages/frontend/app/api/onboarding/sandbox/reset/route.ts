import { NextResponse } from "next/server";

import { fetchUpstream, proxyJson, requireBearerToken } from "@/lib/onboarding/backend-proxy";

export const runtime = "nodejs";

/** ONB-TASK-005: blue/green reset of the caller's Hammerbarn practice
 * sandbox back to the canonical seed. Proxies POST
 * /api/onboarding/sandbox/reset (SandboxResetOut). */
export async function POST(): Promise<NextResponse> {
  const token = await requireBearerToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const upstream = await fetchUpstream("/api/onboarding/sandbox/reset", { method: "POST" }, token);
  if (!upstream) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}
