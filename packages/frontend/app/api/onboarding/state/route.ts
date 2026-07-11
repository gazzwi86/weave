import { NextResponse } from "next/server";

import { fetchUpstream, proxyJson, requireBearerToken } from "@/lib/onboarding/backend-proxy";

export const runtime = "nodejs";

/**
 * ONB-TASK-008: bootstrap read for beacons/modals -- one query returns the
 * full onboarding state including `dismissals`, so callers never issue
 * per-beacon fetches (brief's implementation hint).
 */
export async function GET(): Promise<NextResponse> {
  const token = await requireBearerToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const upstream = await fetchUpstream("/api/onboarding/state", {}, token);
  if (!upstream) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}
