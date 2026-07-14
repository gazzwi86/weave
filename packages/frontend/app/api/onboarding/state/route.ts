import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchUpstream, proxyJson, requireBearerToken } from "@/lib/onboarding/backend-proxy";

export const runtime = "nodejs";

// Law 13: request body is untrusted input -- only the field this task writes
// is accepted, mirrors path/route.ts's PUT validation pattern.
const patchSchema = z.object({
  whats_new_seen_at: z.string().datetime(),
});

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

/** ONB-TASK-012 AC-012-04: clears the What's-new unread dot server-side. */
export async function PATCH(request: Request): Promise<NextResponse> {
  const token = await requireBearerToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const upstream = await fetchUpstream(
    "/api/onboarding/state",
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) },
    token
  );
  if (!upstream) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}
