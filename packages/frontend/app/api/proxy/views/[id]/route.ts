import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { backendUrl, forward, unauthorised } from "@/lib/explorer/proxy-forward";

export const runtime = "nodejs";

/** AC-4: proxies a view delete (403 forbidden / 404 view_not_found are
 * forwarded through as-is by proxy-forward's detail-unwrap). */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return unauthorised();

  const { id } = await context.params;
  return forward(
    fetch(`${backendUrl()}/api/views/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    })
  );
}
