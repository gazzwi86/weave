import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: request body is untrusted input -- validated via zod, never cast.
// Mirrors weave_backend.schemas.authoring.NlAuthoringRequest.
const nlAuthoringRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  known_class_iris: z.record(z.string(), z.string()).default({}),
  preview: z.boolean().default(false),
});

/** TASK-006 AC-006-02/AC-006-06: the chat panel's "propose, then confirm"
 * step -- proxies to CE-TASK-004's `/api/ontology/authoring/nl`, which
 * CE-TASK-006 extended with a `preview` flag (parse-only, no dispatch).
 * A 422 `nl_parse_failed` response (ambiguous or unparseable intent) is
 * passed straight through for the chat panel to render as a clarifying
 * question rather than guessing.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = nlAuthoringRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/ontology/authoring/nl`, {
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
