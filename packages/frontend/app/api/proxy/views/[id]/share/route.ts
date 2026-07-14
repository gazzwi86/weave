import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendUrl, forward, unauthorised } from "@/lib/explorer/proxy-forward";

export const runtime = "nodejs";

const shareBodySchema = z.object({ recipients: z.array(z.string().min(1)).default([]) });

/** AC-5: proxies a share -- server decides eligibility, response is
 * `{notified, excluded}` counts only, never identities. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return unauthorised();

  const parsed = shareBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  const { id } = await context.params;
  return forward(
    fetch(`${backendUrl()}/api/views/${encodeURIComponent(id)}/share`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    })
  );
}
