import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: the path param is untrusted input -- validated via zod, never cast.
const requestIdSchema = z.string().min(1).max(100);

/** Proxies the Build engine's per-section drafting progress stream to the
 * backend's `GET /api/requests/{id}/stream` (BE-TASK-003's SSE endpoint --
 * see `requests/store.py`'s module docstring for its replay-on-late-
 * subscribe design). Same unbuffered-passthrough shape as
 * `app/api/dashboard/widgets/generate/route.ts` -- must NOT await `.json()`
 * on the upstream response, or the caller only ever sees the stream after
 * it has already finished.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse | Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = requestIdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request_id" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/api/requests/${encodeURIComponent(parsed.data)}/stream`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": "text/event-stream" },
  });
}
