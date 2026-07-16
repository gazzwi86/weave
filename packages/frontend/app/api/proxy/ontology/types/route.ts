import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

/** TASK-028 AC-2: proxies CE-READ-1's `GET /api/ontology/types` AS-IS
 * (`{kinds, relationships}`), attaching the caller's session bearer token
 * server-side. Unlike `/api/proxy/node-kinds` (a GE-owned colour-palette
 * projection that drops `relationships`), this route is the authoritative
 * kinds+relationships list the boot-time closure drift guard reads. */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const backendUrl = backendApiUrl();

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/ontology/types`, {
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
