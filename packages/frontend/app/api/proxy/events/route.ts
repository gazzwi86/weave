import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendUrl, forward, unauthorised } from "@/lib/explorer/proxy-forward";

export const runtime = "nodejs";

const eventsQuerySchema = z.object({
  since_seq: z.coerce.number().int().nonnegative(),
  limit: z.coerce.number().int().positive().max(1000).default(200),
});

/** AC-7: proxies the CE-EVENT-1 beta seq feed poll. A 410 (cursor aged
 * out) is forwarded through as-is -- proxy-forward's detail-unwrap turns
 * `{"detail":{"error":"cursor_aged_out"}}` into `{"error":"cursor_aged_out"}`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return unauthorised();

  const parsed = eventsQuerySchema.safeParse({
    since_seq: request.nextUrl.searchParams.get("since_seq") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 422 });
  }

  const query = new URLSearchParams({
    since_seq: String(parsed.data.since_seq),
    limit: String(parsed.data.limit),
  }).toString();
  return forward(
    fetch(`${backendUrl()}/api/events?${query}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    })
  );
}
