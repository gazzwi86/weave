import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: mirrors weave_backend's PinUpgradeRequest (schemas/project_pin.py).
const upgradePinSchema = z.object({
  confirm_version_iri: z.string().min(1),
});

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) return null;
  return { token: session.accessToken };
}

type RouteParams = { params: Promise<{ id: string }> };

/** TASK-016 AC-3/AC-4: forwards to the backend `pin-upgrade` route, the
 * real role-guard (403) and race-check (409 `pin_moved`) boundary -- this
 * proxy validates shape only, never authorises. */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = upgradePinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/pin-upgrade`, caller.token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
