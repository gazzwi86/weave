import { NextResponse } from "next/server";

import { auth } from "@/auth";

export const runtime = "nodejs";

/** Proxies the "Verify chain" button to the backend's admin-only
 * `POST /api/audit/verify`. No body either way (Law 13: nothing to
 * validate) -- the backend re-walks its own hash chain and reports.
 */
export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/audit/verify`, {
      method: "POST",
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
