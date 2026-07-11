import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendUrl, forward, unauthorised } from "@/lib/explorer/proxy-forward";

export const runtime = "nodejs";

const targetQuerySchema = z.object({
  target_kind: z.enum(["node", "view"]),
  target_ref: z.string().min(1),
});

const createCommentBodySchema = z.object({
  target_kind: z.enum(["node", "view"]),
  target_ref: z.string().min(1),
  body: z.string().min(1),
});

/** AC-6: proxies a comment list for one target (node or view). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return unauthorised();

  const parsed = targetQuerySchema.safeParse({
    target_kind: request.nextUrl.searchParams.get("target_kind"),
    target_ref: request.nextUrl.searchParams.get("target_ref") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "missing_target" }, { status: 400 });
  }

  const query = new URLSearchParams(parsed.data).toString();
  return forward(
    fetch(`${backendUrl()}/api/comments?${query}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    })
  );
}

/** AC-6: proxies a comment create -- `author` is always server-stamped
 * from the session, never accepted from the request body (matches
 * comments.py's `_reject_spoofed_author`: this schema doesn't even have
 * an `author` field to strip). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return unauthorised();

  const parsed = createCommentBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  return forward(
    fetch(`${backendUrl()}/api/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    })
  );
}
