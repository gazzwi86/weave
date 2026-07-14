import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

const publishSchema = z.object({
  widget_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

/** Proxies `POST /api/dashboard/library` (TASK-015 AC-1/AC-2: publish a
 * pinned widget to the tenant library; 403 passes through as-is on the
 * author-authority gate). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = publishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return forwardToBackend("/api/dashboard/library", session.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}

/** Proxies `GET /api/dashboard/library` (TASK-015 AC-4: visible to any
 * tenant member, read authority suffices). */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  return forwardToBackend("/api/dashboard/library", session.accessToken, { method: "GET" });
}
