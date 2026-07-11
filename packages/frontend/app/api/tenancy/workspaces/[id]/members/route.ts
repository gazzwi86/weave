import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: path segment + request body are untrusted input.
const idSchema = z.string().min(1).max(100);
const inviteSchema = z.object({
  email: z.string().email().max(320),
  role: z.string().min(1).max(50),
});

const backendUrl = () => process.env.BACKEND_API_URL ?? "http://localhost:8000";

function proxyJson(upstream: Response): Promise<NextResponse> {
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return Promise.resolve(NextResponse.json({ error: "upstream_unavailable" }, { status: 502 }));
  }
  return upstream.json().then((body: unknown) => NextResponse.json(body, { status: upstream.status }));
}

/** AC-1: proxies `GET /api/workspaces/{workspace_id}/members` with the
 * caller's session bearer token -- tenant/workspace scoping is enforced
 * server-side by the backend's `require_workspace_role("read")`.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsedId = idSchema.safeParse((await params).id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/api/workspaces/${encodeURIComponent(parsedId.data)}/members`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  return proxyJson(upstream);
}

/** AC-2: proxies the invite action (`POST /api/workspaces/{workspace_id}/members`). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsedId = idSchema.safeParse((await params).id);
  const parsedBody = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsedId.success || !parsedBody.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/api/workspaces/${encodeURIComponent(parsedId.data)}/members`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsedBody.data),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  return proxyJson(upstream);
}
