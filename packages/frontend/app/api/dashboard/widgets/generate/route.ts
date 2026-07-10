import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: request body is untrusted input -- validated via zod, never cast.
const generateSchema = z.object({ prompt: z.string().min(1) });

/** Proxies the SSE generate endpoint (TASK-011, m2-delta.md §3). Unlike
 * `lib/build/backend-proxy.ts::forwardToBackend`, this must NOT await
 * `.json()` on the upstream response -- that would buffer the whole stream
 * and defeat the ≤1s-to-`spec` latency contingency (AC-3). Passes
 * `upstream.body` straight through instead.
 */
export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = generateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/dashboard/widgets/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": "text/event-stream" },
  });
}
