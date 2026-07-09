import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: mirrors weave_backend's UpsertContributorRequest
// (schemas/contributors.py) -- role is admin|editor only.
const upsertContributorSchema = z.object({
  principal_iri: z.string().min(1),
  role: z.enum(["admin", "editor"]),
});

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) return null;
  return { token: session.accessToken };
}

type RouteParams = { params: Promise<{ id: string }> };

/** AC-5: lists a project's contributors -- no role guard (read access is
 * company-wide, matching TASK-014's `GET .../contributors`). */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/contributors`, caller.token);
}

/** AC-5: add/change-role, forwarded to TASK-014's
 * `PUT .../contributors/{principal_iri}` -- admin-only server-side
 * (Role Guard), this proxy validates shape only. */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = upsertContributorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { id } = await params;
  const path = `/api/projects/${encodeURIComponent(id)}/contributors/${encodeURIComponent(
    parsed.data.principal_iri
  )}`;
  return forwardToBackend(path, caller.token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: parsed.data.role }),
  });
}
