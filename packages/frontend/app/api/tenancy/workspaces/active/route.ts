import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

/** Proxies `GET /api/workspaces/active` (the caller's server-side active
 * workspace id, or null before their first switch) with the session bearer
 * token attached server-side. */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const backendUrl = backendApiUrl();
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/workspaces/active`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}
