import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: the path param is untrusted input -- validated via zod, never cast.
const proposalIdSchema = z.string().min(1).max(100);

/** TASK-013 AC-002-05: the chat panel's per-proposal reject button --
 * carries no request body, mirrors the accept proxy.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = proposalIdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_proposal_id" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/api/ingest/proposals/${encodeURIComponent(parsed.data)}/reject`,
      { method: "POST", headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" }
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
