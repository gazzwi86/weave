import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
// All seven `PLAT-AUDIT-1` filter dimensions (contracts.md), forwarded
// verbatim to the backend, which is the schema/tenant-scoping authority.
const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1),
  per_page: z.coerce.number().int().min(1).max(200),
  engine: z.string().min(1).optional(),
  event_type: z.string().min(1).optional(),
  actor_principal_iri: z.string().min(1).optional(),
  target_iri: z.string().min(1).optional(),
  date_from: z.string().min(1).optional(),
  date_to: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
});

const FILTER_KEYS = [
  "engine",
  "event_type",
  "actor_principal_iri",
  "target_iri",
  "date_from",
  "date_to",
  "q",
] as const;

/** Resolves the caller's tenant id from the session JWT, or null when the
 * caller is unauthenticated / has no tenant claim -- same posture as the
 * tenancy proxy: the tenant id is derived server-side so a client can never
 * page through another tenant's trail.
 */
async function resolveCaller(): Promise<{ tenantId: string; token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) {
    return null;
  }
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) {
    return null;
  }
  return { tenantId, token: session.accessToken };
}

function buildBackendQuery(
  tenantId: string,
  data: z.infer<typeof auditQuerySchema>
): URLSearchParams {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(data.page),
    per_page: String(data.per_page),
  });
  FILTER_KEYS.forEach((key) => {
    const value = data[key];
    if (value) {
      query.set(key, value);
    }
  });
  return query;
}

async function proxyJson(upstream: Response): Promise<NextResponse> {
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}

/** Proxies the log viewer to the backend's admin-only `GET /api/audit`.
 * Upstream status passes through (incl. the 403 non-admin rejection).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await resolveCaller();
  if (!caller) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = auditQuerySchema.safeParse({
    page: params.get("page") ?? "1",
    per_page: params.get("per_page") ?? "50",
    ...Object.fromEntries(
      FILTER_KEYS.map((key) => [key, params.get(key) ?? undefined])
    ),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  const query = buildBackendQuery(caller.tenantId, parsed.data);
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/audit?${query.toString()}`, {
      headers: { Authorization: `Bearer ${caller.token}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}
