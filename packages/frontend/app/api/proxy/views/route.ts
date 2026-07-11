import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendUrl, forward, unauthorised } from "@/lib/explorer/proxy-forward";

export const runtime = "nodejs";

// Law 13: request body is untrusted input -- validated via zod, matches
// schemas/views.py's ViewCreateRequest (extra="allow" server-side, but the
// proxy only needs to validate the fields it forwards on).
const positionSchema = z.object({
  node_iri: z.string().min(1),
  position_x: z.number(),
  position_y: z.number(),
});

const saveViewBodySchema = z.object({
  name: z.string().min(1),
  overwrite: z.boolean().optional(),
  definition: z.record(z.string(), z.unknown()),
  positions: z.array(positionSchema).default([]),
});

/** AC-4: proxies the tenant view library list. */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return unauthorised();

  return forward(
    fetch(`${backendUrl()}/api/views`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    })
  );
}

/** AC-1: proxies a save (name collision -> 409 name_collision, passed
 * through by proxy-forward's detail-unwrap). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) return unauthorised();

  const parsed = saveViewBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  return forward(
    fetch(`${backendUrl()}/api/views`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    })
  );
}
