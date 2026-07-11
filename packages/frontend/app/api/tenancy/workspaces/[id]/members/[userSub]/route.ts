import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: path segments are untrusted input.
const idSchema = z.string().min(1).max(100);

/** AC-2: proxies revoke (`DELETE /api/workspaces/{workspace_id}/members/{user_sub}`). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userSub: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id, userSub } = await params;
  const parsedId = idSchema.safeParse(id);
  const parsedSub = idSchema.safeParse(userSub);
  if (!parsedId.success || !parsedSub.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/api/workspaces/${encodeURIComponent(parsedId.data)}/members/${encodeURIComponent(parsedSub.data)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}
