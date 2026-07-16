import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: request body is untrusted input.
const choiceSchema = z.object({
  role_path: z.enum(["business", "technical", "compliance", "admin"]),
});


function proxyJson(upstream: Response): Promise<NextResponse> {
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return Promise.resolve(NextResponse.json({ error: "upstream_unavailable" }, { status: 502 }));
  }
  return upstream.json().then((body: unknown) => NextResponse.json(body, { status: upstream.status }));
}

/** ONB-TASK-006 AC-006-01/03/04/06: proxies `GET /api/onboarding/path`. */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendApiUrl()}/api/onboarding/path`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}

/** AC-006-04: proxies `PUT /api/onboarding/path` ("change my onboarding path"). */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = choiceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendApiUrl()}/api/onboarding/path`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}
