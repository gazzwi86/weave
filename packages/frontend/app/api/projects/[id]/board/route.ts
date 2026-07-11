import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/** BE-V1-TASK-017 AC-1: forwards to `GET /api/projects/{id}/board`. */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/board`, session.accessToken);
}
