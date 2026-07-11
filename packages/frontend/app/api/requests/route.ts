import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: request body is untrusted input -- validated via zod, never cast.
// Mirrors the backend's POST /api/requests contract (Build engine).
const createRequestSchema = z.object({
  prompt: z.string().min(1),
  run_mode: z.enum(["draft_spec_only", "spec_to_build", "spike"]),
  description: z.string().optional(),
  name: z.string().min(1).max(200),
  grounding_entity_iris: z.array(z.string()).default([]),
  target_repo_name: z.string().optional(),
});

/** Proxies the Build engine's "Request application" form to the backend's
 * `POST /api/requests`, attaching the caller's session bearer token. Backend
 * statuses (202/422/503) pass through unchanged so the page can render the
 * contract's error shapes directly.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = createRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/requests`, {
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
