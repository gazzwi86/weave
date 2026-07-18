import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: mirrors schemas/governance.py's ShapeRuleCommitRequest.
const shapeCommitRequestSchema = z.object({
  shape_turtle: z.string().min(1),
  ai_generated: z.boolean().default(false),
});

/** New rule drawer's commit step (G3, remediation-2-api-gaps.md): proxies
 * to governance.py's `POST /api/ontology/authoring/nl/shapes/commit`, which
 * re-validates `shape_turtle` server-side regardless of whether it came
 * from a preview or was hand-authored raw SHACL.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = shapeCommitRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return forwardToBackend("/api/ontology/authoring/nl/shapes/commit", session.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
