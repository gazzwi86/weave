import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: mirrors weave_backend's UpdateProjectSettingsRequest
// (schemas/project_settings.py) -- both fields optional, each PATCH-able
// independently.
const updateSettingsSchema = z.object({
  model_tier: z.string().min(1).nullish(),
  cost_cap_usd: z.number().nullish(),
});

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) return null;
  return { token: session.accessToken };
}

type RouteParams = { params: Promise<{ id: string }> };

/** AC-3/AC-4: reads the resolved governance cascade -- no role guard
 * (any tenant member may read, matching TASK-014's `GET .../settings`). */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/settings`, caller.token);
}

/** AC-3/AC-4: forwards to TASK-014's `PATCH .../settings`, which is the
 * real Role Guard boundary (403 for non-admins) -- this proxy validates
 * shape only, never authorises. 422 (cascade validation) and 503
 * (project-scope write unreachable, ADR-013 gap) pass through untouched
 * so the UI can render AC-3's cascade-level message and the
 * unavailable-write state verbatim. */
export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = updateSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/settings`, caller.token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
