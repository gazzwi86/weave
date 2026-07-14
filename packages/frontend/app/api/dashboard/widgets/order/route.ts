import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

const orderPatchSchema = z.object({
  ids_in_order: z.array(z.string()).min(1),
});

/** Proxies `PATCH /api/dashboard/widgets/order` (TASK-014 AC-5: batch
 * drag-reorder, one PATCH, one audit entry on the backend). */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = orderPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return forwardToBackend("/api/dashboard/widgets/order", session.accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
