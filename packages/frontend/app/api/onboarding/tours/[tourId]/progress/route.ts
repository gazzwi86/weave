import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";

export const runtime = "nodejs";

// Law 13: request body is untrusted input.
const progressSchema = z.object({
  last_completed_step: z.number().int().min(0),
  completed: z.boolean().optional(),
  skipped: z.boolean().optional(),
});

const backendUrl = () => process.env.BACKEND_API_URL ?? "http://localhost:8000";

function proxyJson(upstream: Response): Promise<NextResponse> {
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return Promise.resolve(NextResponse.json({ error: "upstream_unavailable" }, { status: 502 }));
  }
  return upstream.json().then((body: unknown) => NextResponse.json(body, { status: upstream.status }));
}

/** ONB-TASK-007 AC-007-02: proxies `PUT /api/onboarding/tours/{tour_id}/progress`. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tourId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = progressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { tourId } = await params;
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/api/onboarding/tours/${encodeURIComponent(tourId)}/progress`, {
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
