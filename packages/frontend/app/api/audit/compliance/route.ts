import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: `period` is untrusted input -- validated via zod, never cast.
const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .optional();

/** AC-7: proxies the compliance sub-view to the backend's
 * `GET /api/audit/compliance`, attaching the caller's session bearer token
 * and forwarding the optional `period` (YYYY-MM) query param used for
 * month-over-month trends -- the backend scopes the summary to the caller's
 * own tenant from the token, same as `api/billing/usage`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = periodSchema.safeParse(
    request.nextUrl.searchParams.get("period") ?? undefined
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  const query = parsed.data ? `?period=${parsed.data}` : "";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/audit/compliance${query}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}
