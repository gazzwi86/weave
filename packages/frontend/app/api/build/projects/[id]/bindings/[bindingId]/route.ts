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

type RouteParams = { params: Promise<{ id: string; bindingId: string }> };

/** AC-5: remove a binding, forwarded to TASK-022's
 * `DELETE .../bindings/{binding_id}` -- admin-only server-side (Role
 * Guard). Returns 204 on success, straight through. */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id, bindingId } = await params;
  const path = `/api/projects/${encodeURIComponent(id)}/bindings/${encodeURIComponent(bindingId)}`;
  return forwardToBackend(path, caller.token, { method: "DELETE" });
}
