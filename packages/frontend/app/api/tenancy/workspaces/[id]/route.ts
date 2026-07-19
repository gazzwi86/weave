import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: request body is untrusted input -- validated via zod, mirrors
// weave_backend's UpdateWorkspaceRequest (description, max 2000 chars).
const updateWorkspaceSchema = z.object({
  description: z.string().max(2000),
});

/** Proxies the workspace description update
 * (`PUT /api/tenants/{tenant_id}/workspaces/{workspace_id}`), tenant-scoped
 * server-side from the session token so a client can never target another
 * tenant's workspace through this route. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = updateWorkspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { id } = await params;
  const backendUrl = backendApiUrl();
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/api/tenants/${tenantId}/workspaces/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
        cache: "no-store",
      }
    );
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
