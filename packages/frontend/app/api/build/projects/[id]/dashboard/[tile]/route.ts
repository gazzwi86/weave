import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) return null;
  return { token: session.accessToken };
}

type RouteParams = { params: Promise<{ id: string; tile: string }> };

/** Read-only proxy, no request body -- Law 13 N/A (same as the backend's
 * `routers/dashboard.py`).
 */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id, tile } = await params;
  return forwardToBackend(
    `/api/projects/${encodeURIComponent(id)}/dashboard/${encodeURIComponent(tile)}`,
    caller.token
  );
}
