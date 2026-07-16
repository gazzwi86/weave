import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: request body is untrusted input -- validated via zod, never cast.
// The scope IRI is built server-side from the token's tenant claim, so a
// client can never set a cap on another tenant's scope through this proxy.
const setCapSchema = z.object({
  value_usd: z.number().positive(),
  workspace_id: z.string().min(1).optional(),
});

/** Proxy for the Settings -> Models & AI budget-cap form. Forwards
 * `PUT /api/billing/caps` with a server-derived scope IRI:
 * company-wide `urn:weave:tenant:{tenantId}:company`, or per-workspace
 * `urn:weave:tenant:{tenantId}:ws:{workspaceId}`. Backend errors
 * (422 cap_exceeds_parent, 403 admin-only) pass through as-is.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = setCapSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { value_usd: valueUsd, workspace_id: workspaceId } = parsed.data;
  const scopeIri = workspaceId
    ? `urn:weave:tenant:${tenantId}:ws:${workspaceId}`
    : `urn:weave:tenant:${tenantId}:company`;

  const backendUrl = backendApiUrl();
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/billing/caps`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope_iri: scopeIri, value_usd: valueUsd }),
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
