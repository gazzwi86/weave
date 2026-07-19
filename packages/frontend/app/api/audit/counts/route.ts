import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
// Same six `PLAT-AUDIT-1` filter dimensions as `GET /api/audit` minus
// pagination (a grouped-count response has no page/per_page).
const countsQuerySchema = z.object({
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

/** Resolves the caller's tenant id from the session JWT, same posture as
 * `app/api/audit/route.ts` -- derived server-side so a client can never
 * request another tenant's counts. */
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

function buildBackendQuery(tenantId: string, data: z.infer<typeof countsQuerySchema>): URLSearchParams {
  const query = new URLSearchParams({ tenant_id: tenantId });
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

/** Proxies the dashboard health cards to the backend's admin-only
 * `GET /api/audit/counts` (G6). Upstream status passes through, including
 * the 403 non-admin rejection, which the dashboard degrades gracefully for.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await resolveCaller();
  if (!caller) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = countsQuerySchema.safeParse(
    Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? undefined]))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  const query = buildBackendQuery(caller.tenantId, parsed.data);
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/audit/counts?${query.toString()}`, {
      headers: { Authorization: `Bearer ${caller.token}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return proxyJson(upstream);
}
