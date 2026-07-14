import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fetchUpstream, proxyJson, requireBearerToken } from "@/lib/onboarding/backend-proxy";

export const runtime = "nodejs";

// Law 13: kind is a closed vocabulary (mirrors backend's DismissalKindIn).
const kindSchema = z.enum(["beacon", "welcome_modal"]);

type RouteParams = { params: Promise<{ kind: string; refId: string }> };

async function proxyDismissal(method: "PUT" | "DELETE", { params }: RouteParams): Promise<NextResponse> {
  const token = await requireBearerToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { kind, refId } = await params;
  const parsedKind = kindSchema.safeParse(kind);
  if (!parsedKind.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const upstream = await fetchUpstream(`/api/onboarding/dismissals/${parsedKind.data}/${encodeURIComponent(refId)}`, { method }, token);
  if (!upstream) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}

/** AC-008-02/04: persists a beacon or welcome-modal dismissal server-side. */
export async function PUT(_request: NextRequest, routeParams: RouteParams): Promise<NextResponse> {
  return proxyDismissal("PUT", routeParams);
}

/** Un-dismisses a single beacon/modal (used by the per-item restore path). */
export async function DELETE(_request: NextRequest, routeParams: RouteParams): Promise<NextResponse> {
  return proxyDismissal("DELETE", routeParams);
}
