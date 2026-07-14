import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/** Proxies `POST /api/dashboard/library/{id}/add` (TASK-015 AC-3: creates
 * an independent (tenant, user) copy). No request body. */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  return forwardToBackend(`/api/dashboard/library/${encodeURIComponent(id)}/add`, session.accessToken, {
    method: "POST",
  });
}
