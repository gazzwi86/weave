import { NextResponse } from "next/server";

import { auth } from "@/auth";

export const runtime = "nodejs";

/** TASK-004 AC-004-04: E4-S2 AI extraction is Should-Have/deferred -- this
 * stub is the extraction affordance's whole backend today: it always 503s.
 * No `BACKEND_API_URL` fetch happens here (there is nothing to proxy to
 * yet). When E4-S2 ships, this handler is the single place that changes
 * (swap the hardcoded 503 for a real backend proxy call, same shape as
 * `operations/apply/route.ts`) -- the button/component calling it never
 * needs to change (FR-024 "additive" degradation).
 */
export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  return NextResponse.json({ error: "extraction_not_available" }, { status: 503 });
}
