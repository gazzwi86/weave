import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

/** TASK-027: proxies CE-READ-1's `coverage_gap_process` named pattern
 * (`GET /api/sparql?pattern=coverage_gap_process`, contracts.md CE-READ-1 /
 * `rdf/patterns.py`) AS-IS, attaching the caller's session bearer token
 * server-side. No client-supplied param -- `pattern` is fixed, so this
 * route never lets a caller name an arbitrary pattern (Law 13). */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const backendUrl = backendApiUrl();
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/sparql?pattern=coverage_gap_process`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}
