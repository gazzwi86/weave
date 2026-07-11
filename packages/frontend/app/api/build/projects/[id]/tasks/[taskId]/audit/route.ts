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

type RouteParams = { params: Promise<{ id: string; taskId: string }> };

/** BE-V1-TASK-018 AC-5: proxies `GET .../tasks/{task_id}/audit` -- a 503
 * `audit_unavailable` from the backend passes through unwrapped, the Audit
 * tab renders the honest unavailable state, never a fabricated row. */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id, taskId } = await params;
  return forwardToBackend(
    `/api/projects/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}/audit`,
    caller.token
  );
}
