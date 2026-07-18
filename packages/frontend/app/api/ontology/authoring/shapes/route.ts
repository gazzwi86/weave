import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
const retireShapeQuerySchema = z.object({
  shape_iri: z.string().min(1),
});

/** Retire flow (G3, remediation-2-api-gaps.md): proxies to governance.py's
 * `DELETE /api/ontology/authoring/shapes?shape_iri=...`. A tenant shape
 * retires (204); a framework shape 403s (`framework_shape_immutable`) --
 * the ConfirmDialog caller is expected to only offer this for
 * `origin === "tenant"` rows, so a 403 here means the UI gate was bypassed.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = retireShapeQuerySchema.safeParse({
    shape_iri: request.nextUrl.searchParams.get("shape_iri") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  return forwardToBackend(
    `/api/ontology/authoring/shapes?shape_iri=${encodeURIComponent(parsed.data.shape_iri)}`,
    session.accessToken,
    { method: "DELETE" }
  );
}
