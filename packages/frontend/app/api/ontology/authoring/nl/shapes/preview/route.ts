import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: mirrors schemas/governance.py's ShapeRulePreviewRequest.
const shapePreviewRequestSchema = z.object({
  text: z.string().min(1).max(2000),
});

/** New rule drawer's preview step (G3/G14, remediation-2-api-gaps.md):
 * proxies to governance.py's `POST /api/ontology/authoring/nl/shapes/preview`
 * -- never commits, just returns a candidate shape for review. A 503
 * (`model_provider_unavailable`) or 422 (`shape_generation_failed`) passes
 * straight through for the drawer to render as graceful degradation.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = shapePreviewRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return forwardToBackend("/api/ontology/authoring/nl/shapes/preview", session.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
