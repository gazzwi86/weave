import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: request body untrusted input -- validated via zod, never cast.
// Mirrors weave_backend.schemas.query.NlQueryRequest.
const nlQuerySchema = z.object({
  question: z.string().min(1).max(500),
  workspace_id: z.string().min(1).nullable().optional(),
  version: z.string().min(1).optional(),
  page: z.number().int().min(1).optional(),
});

/** CE-TASK-007 AC-007-01/-07: proxies a natural-language question to the
 * backend's `POST /api/query/nl`, attaching the caller's session bearer
 * token. Forwards the backend's error body as-is (e.g. `translation_failed`,
 * `prohibited_clause`) so the editor UI can render the precise reason.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = nlQuerySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/query/nl`, {
      method: "POST",
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

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}
