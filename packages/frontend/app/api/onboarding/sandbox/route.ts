import { NextResponse } from "next/server";

import { fetchUpstream, proxyJson, requireBearerToken } from "@/lib/onboarding/backend-proxy";

export const runtime = "nodejs";

/** ONB-TASK-004/005: ensures the caller's Hammerbarn practice sandbox exists
 * (idempotent fork). Proxies POST /api/onboarding/sandbox (SandboxOut). */
export async function POST(): Promise<NextResponse> {
  const token = await requireBearerToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const upstream = await fetchUpstream("/api/onboarding/sandbox", { method: "POST" }, token);
  if (!upstream) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}
