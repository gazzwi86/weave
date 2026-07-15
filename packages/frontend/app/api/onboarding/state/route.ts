import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchUpstream, proxyJson, requireBearerToken } from "@/lib/onboarding/backend-proxy";

export const runtime = "nodejs";

// Law 13: request body is untrusted input -- strict allow-list of every
// bootstrap-state field any PATCH caller writes. All optional (each caller
// sends only its own field), unknown keys rejected.
const patchSchema = z
  .object({
    whats_new_seen_at: z.string().datetime().optional(),
    checklist_dismissed_at: z.string().datetime().optional(),
    checklist_completed_at: z.string().datetime().optional(),
  })
  .strict();

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

/**
 * ONB-TASK-012 AC-012-04 / TASK-010 AC-010-05: single PATCH proxy for every
 * bootstrap-state field callers write (what's-new-seen, checklist dismiss,
 * checklist true-completion). Zod-validated allow-list (Law 13).
 */
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
