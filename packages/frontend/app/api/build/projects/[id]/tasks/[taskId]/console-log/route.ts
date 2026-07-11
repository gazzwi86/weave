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

/** BE-V1-TASK-018 AC-4: proxies `GET .../tasks/{task_id}/console-log` -- a
 * finished run's S3-persisted log content (a browser cannot read S3
 * directly, so this is the Console tab's only content route). */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id, taskId } = await params;
  return forwardToBackend(
    `/api/projects/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}/console-log`,
    caller.token
  );
}
