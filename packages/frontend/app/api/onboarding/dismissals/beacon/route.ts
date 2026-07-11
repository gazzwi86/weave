import { NextResponse } from "next/server";

import { fetchUpstream, proxyJson, requireBearerToken } from "@/lib/onboarding/backend-proxy";

export const runtime = "nodejs";

/** AC-008-02: bulk-restores all dismissed beacons ("Show all hints"). */
export async function DELETE(): Promise<NextResponse> {
  const token = await requireBearerToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const upstream = await fetchUpstream("/api/onboarding/dismissals/beacon", { method: "DELETE" }, token);
  if (!upstream) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}
