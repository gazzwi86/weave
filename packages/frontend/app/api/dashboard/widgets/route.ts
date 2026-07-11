import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

/** Proxies `GET /api/dashboard/widgets` (TASK-010/012). `scope` is a closed
 * enum on the backend (`tenant_default` | `user`) -- passed through
 * verbatim, the backend itself 422s an invalid value. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const scope = request.nextUrl.searchParams.get("scope") ?? "tenant_default";
  return forwardToBackend(
    `/api/dashboard/widgets?scope=${encodeURIComponent(scope)}`,
    session.accessToken
  );
}
