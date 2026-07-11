import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: mirrors weave_backend's CreatePromptRequest (schemas/prompts.py).
// Blank-after-trim / max-length rejection (AC-6) is a backend business rule
// (per-project settings cascade) -- this only guards the shape.
const createPromptSchema = z.object({ prompt_text: z.string().min(1) });

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  return { token: session.accessToken };
}

type RouteParams = { params: Promise<{ id: string }> };

/** BE-V1-TASK-021 (FR-065): forwards a direct project prompt to
 * `POST /api/projects/{id}/prompts` -- role/audit (AC-2) and validation
 * (AC-6) enforcement live entirely server-side; this proxy only validates
 * shape and attaches the caller's bearer token. */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = createPromptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { id } = await params;
  return forwardToBackend(`/api/projects/${encodeURIComponent(id)}/prompts`, caller.token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
