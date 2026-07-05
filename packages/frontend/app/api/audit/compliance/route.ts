import { NextResponse } from "next/server";

import { auth } from "@/auth";

export const runtime = "nodejs";

/** AC-7: proxies the compliance sub-view to the backend's
 * `GET /api/audit/compliance`, attaching the caller's session bearer token.
 * No query params to validate (Law 13) -- the backend scopes the summary to
 * the caller's own tenant from the token, same as `api/billing/usage`.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/audit/compliance`, {
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
