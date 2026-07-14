import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";

export const runtime = "nodejs";

// Law 13: request body is untrusted input.
const updateSchema = z.object({
  event_type: z.string().min(1),
  channels: z.array(z.string()).min(1),
});

const backendUrl = () => process.env.BACKEND_API_URL ?? "http://localhost:8000";

function proxyJson(upstream: Response): Promise<NextResponse> {
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return Promise.resolve(NextResponse.json({ error: "upstream_unavailable" }, { status: 502 }));
  }
  return upstream.json().then((body: unknown) => NextResponse.json(body, { status: upstream.status }));
}

/** AC-4: proxies `GET /api/notifications/preferences` with the caller's
 * session bearer token -- per-user, tenant-scoped, no workspace_id needed.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/api/notifications/preferences`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  const proxied = await proxyJson(upstream);
  if (upstream.status !== 200) return proxied;
  // AC-6: the matrix's lock decision needs the caller's role -- the
  // backend response has no role field, so the proxy attaches the same
  // session-claims role BellPanel already reads (lib/auth/session-claims.ts).
  const body = (await proxied.json()) as Record<string, unknown>;
  const { role } = getSessionClaims(session.accessToken);
  return NextResponse.json({ ...body, role }, { status: 200 });
}

/** AC-5/AC-6: proxies `PUT /api/notifications/preferences` (one event_type's
 * channel list per call, matching the matrix's per-cell toggle).
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/api/notifications/preferences`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  return proxyJson(upstream);
}
