import { NextRequest, NextResponse } from "next/server";

import { fetchUpstream, proxyJson, requireBearerToken } from "@/lib/onboarding/backend-proxy";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ milestoneId: string }> };

/** TASK-010 AC-010-03: manual self-mark for milestones with no platform
 * signal to poll (e.g. invite_admin) -- backend allowlists milestoneId. */
export async function POST(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const token = await requireBearerToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { milestoneId } = await params;
  const upstream = await fetchUpstream(
    `/api/onboarding/milestones/${encodeURIComponent(milestoneId)}/self-mark`,
    { method: "POST" },
    token
  );
  if (!upstream) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}
