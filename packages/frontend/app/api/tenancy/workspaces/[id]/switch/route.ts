import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: the path segment is untrusted input.
const idSchema = z.string().min(1).max(100);

/** Proxies the workspace switch (`POST /api/workspaces/{id}/switch`) with
 * the caller's session bearer token. The backend stores the active
 * workspace server-side (Redis session state), so the client only needs
 * the 200 to reload. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/api/workspaces/${encodeURIComponent(parsed.data)}/switch`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      }
    );
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
