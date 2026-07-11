import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  return { token: session.accessToken };
}

type RouteParams = { params: Promise<{ id: string }> };

/** BE-V1-TASK-021 (FR-065 AC-4): read-only proxy to the existing
 * `GET /api/state/{project_iri}` run-status channel -- the same one
 * `/runs` populates, reused here so the prompt box's status chip has
 * something to poll (no new status endpoint). Read-only, no request
 * body -- Law 13 N/A. */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  return forwardToBackend(`/api/state/${encodeURIComponent(id)}`, caller.token);
}
