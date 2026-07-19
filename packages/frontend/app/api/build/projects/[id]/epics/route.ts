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

type RouteParams = { params: Promise<{ id: string }> };

/** B2 (docs/design/remediation-2-api-gaps.md G9/G10): read-only proxy over
 * `routers/epics.py`'s `GET /api/projects/{project_iri}/epics` -- no
 * request body, so Law 13 is N/A (same as `dashboard/[tile]/route.ts`).
 */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/epics`, caller.token);
}
