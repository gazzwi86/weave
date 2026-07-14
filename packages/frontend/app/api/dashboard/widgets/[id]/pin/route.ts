import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/** Proxies `POST /api/dashboard/widgets/{id}/pin` (TASK-014 AC-1/AC-2/AC-6,
 * ADR-021). No request body -- pin acts on the already-persisted row. */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  return forwardToBackend(`/api/dashboard/widgets/${encodeURIComponent(id)}/pin`, session.accessToken, {
    method: "POST",
  });
}
