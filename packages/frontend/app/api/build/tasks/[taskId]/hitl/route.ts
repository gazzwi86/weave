import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: request body is untrusted input -- validated via zod, mirroring
// the backend's `HitlActionRequest` (an `amend` action requires non-empty
// `amendment`; the backend re-validates this too, defence in depth).
const hitlActionSchema = z
  .object({
    action: z.enum(["approve", "reject", "amend"]),
    amendment: z.string().min(1).optional(),
  })
  .refine((body) => body.action !== "amend" || Boolean(body.amendment), {
    message: "amendment is required when action is amend",
  });

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) return null;
  return { token: session.accessToken };
}

type RouteParams = { params: Promise<{ taskId: string }> };

/** Proxies `POST /api/tasks/{task_id}/hitl` (the review-gate drawer's
 * Approve/Request-changes actions). Self-approval 403
 * (`self_approval_not_permitted`) and every other backend error pass
 * through unchanged via `forwardToBackend`.
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = hitlActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { taskId } = await params;
  return forwardToBackend(`/api/tasks/${encodeURIComponent(taskId)}/hitl`, caller.token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
