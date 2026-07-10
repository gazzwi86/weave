import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: mirrors weave_backend's SourceControlPutRequest
// (schemas/source_control.py) -- provider is github|gitlab only. Token
// validation deliberately stays min(1) here too (AC-1): a stricter
// constraint risks echoing the real value into a zod error message.
const sourceControlPutRequestSchema = z.object({
  provider: z.enum(["github", "gitlab"]),
  token: z.string().min(1),
});

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) return null;
  return { token: session.accessToken };
}

type RouteParams = { params: Promise<{ id: string }> };

/** AC-5: reads a project's source-control config -- no role guard (read
 * access is company-wide, matching TASK-014's `GET .../contributors`). A
 * 404 (unconfigured, or no such project) passes through as-is -- the UI
 * renders that as the normal setup state, not an error. */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/source-control`, caller.token);
}

/** AC-1/AC-2/AC-3: configure (or replace) the provider + token, forwarded
 * to TASK-023's `PUT .../source-control` -- admin-only server-side (Role
 * Guard), this proxy validates shape only and never stores or logs the
 * token itself. */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = sourceControlPutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/source-control`, caller.token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
