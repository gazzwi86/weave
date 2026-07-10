import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: mirrors weave_backend's BindRequest (schemas/bindings.py) --
// system is confluence|jira|servicenow only.
const bindRequestSchema = z.object({
  system: z.enum(["confluence", "jira", "servicenow"]),
  connector_ref: z.string().min(1),
  space_ref: z.string().min(1),
});

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) return null;
  return { token: session.accessToken };
}

type RouteParams = { params: Promise<{ id: string }> };

/** AC-1: lists a project's external bindings -- no role guard (read access
 * is company-wide, matching TASK-014's `GET .../contributors`). */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/bindings`, caller.token);
}

/** AC-2/AC-4/AC-5: bind a system's space, forwarded to TASK-022's
 * `PUT .../bindings` -- admin-only server-side (Role Guard), this proxy
 * validates shape only. */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = bindRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/bindings`, caller.token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
