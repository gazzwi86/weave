import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: mirrors weave_backend's `list_decisions_route` query params
// (routers/decisions.py) -- validated here too so a malformed query string
// never reaches the backend as an unchecked passthrough.
const decisionsQuerySchema = z.object({
  kind: z.enum(["all", "decision", "task_update", "system"]).default("decision"),
  search: z.string().max(200).optional(),
  cursor: z.coerce.number().int().min(0).optional(),
});

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) return null;
  return { token: session.accessToken };
}

type RouteParams = { params: Promise<{ id: string }> };

/** TASK-020: read-only proxy over `GET /api/projects/{id}/decisions` --
 * no PUT/POST/DELETE exists on this route, matching the backend's
 * read-only PLAT-AUDIT-1 view (AC-4). No role guard on the read, same as
 * TASK-014's contributors list (company-wide read access). */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = decisionsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { id } = await params;
  const query = new URLSearchParams({ kind: parsed.data.kind });
  if (parsed.data.search) query.set("search", parsed.data.search);
  if (parsed.data.cursor !== undefined) query.set("cursor", String(parsed.data.cursor));

  return forwardToBackend(
    `/api/projects/${encodeURIComponent(id)}/decisions?${query.toString()}`,
    caller.token
  );
}
