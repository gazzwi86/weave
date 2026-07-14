import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/** Proxies `POST /api/dashboard/widgets/{id}/refresh` (TASK-010's refresh
 * endpoint; TASK-014 AC-3/AC-4 wires the client auto-refresh loop over it). */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  return forwardToBackend(
    `/api/dashboard/widgets/${encodeURIComponent(id)}/refresh`,
    session.accessToken,
    { method: "POST" }
  );
}
