import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { opSchema } from "@/lib/explorer/operations-schema";

export const runtime = "nodejs";

// `actor` and `run_mode` are deliberately absent: `actor` is always
// server-derived from the session below (never client-supplied identity,
// same rule CE-005 applied to workspace_id), and `run_mode` is a Build
// Engine "spike" concept (ADR-003) the authoring UI never sets.
const applyRequestSchema = z.object({
  operations: z.array(opSchema).min(1),
  target: z.string().min(1).optional(),
  idempotency_key: z.string().min(1).optional(),
});

/** TASK-006 AC-006-03/AC-006-09: the chat panel and guided form both
 * dispatch a confirmed operation batch straight to CE-WRITE-1 through this
 * proxy, and pass its 201/422 response straight back for inline display.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = applyRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // ponytail: no principal_iri claim reaches the browser session (see
  // types/next-auth.d.ts), so attribution falls back to the user's email --
  // `actor` is audit/PROV-O attribution only, never trusted for
  // authorization (see ApplyRequest.actor docstring in operations.py).
  const actor = session.user?.email ?? "unknown-actor";

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/operations/apply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...parsed.data, actor }),
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
