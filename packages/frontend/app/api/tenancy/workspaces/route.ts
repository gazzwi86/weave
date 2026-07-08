import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";

export const runtime = "nodejs";

// Law 13: request body is untrusted input -- validated via zod, never cast.
// Mirrors weave_backend's workspace-create schema (slug ^[a-z0-9][a-z0-9-]*$).
const createWorkspaceSchema = z.object({
  slug: z
    .string()
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  display_name: z.string().min(1).max(200),
});

/** Resolves the caller's tenant id from the session JWT, or null when the
 * caller is unauthenticated / has no tenant claim. The tenant id is derived
 * server-side so a client can never list or create another tenant's
 * workspaces through this proxy. */
async function resolveTenant(): Promise<{ tenantId: string; token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) return null;
  return { tenantId, token: session.accessToken };
}

function proxyResponse(upstream: Response): Promise<NextResponse> | NextResponse {
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  return upstream
    .json()
    .then((body: unknown) => NextResponse.json(body, { status: upstream.status }));
}

/** Lists the caller's tenant's workspaces via the backend's
 * `GET /api/tenants/{tenant_id}/workspaces`, tenant-scoped from the token. */
export async function GET(): Promise<NextResponse> {
  const caller = await resolveTenant();
  if (!caller) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/tenants/${caller.tenantId}/workspaces`, {
      headers: { Authorization: `Bearer ${caller.token}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyResponse(upstream);
}

/** Provisions a workspace via the backend's
 * `POST /api/tenants/{tenant_id}/workspaces`. Upstream status passes through
 * (incl. 409 workspace_slug_taken) so the panel can surface it. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await resolveTenant();
  if (!caller) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = createWorkspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/tenants/${caller.tenantId}/workspaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${caller.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyResponse(upstream);
}
