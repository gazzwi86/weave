import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";
import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import { getPrincipalIriClaim } from "@/lib/explorer/get-principal-iri-claim";
import { opSchema } from "@/lib/explorer/operations-schema";

export const runtime = "nodejs";

// AC-2/ADR-019: `actor` is never a client-suppliable field -- the proxy is
// its only writer, checked explicitly (below) before this schema even
// parses, so a spoofed `actor` gets its own unambiguous 400 rather than
// folding into a generic "unknown key" rejection. `target` is proxy-fixed
// to "draft" (M2 draft-only writes) -- never accepted from the client.
const applyRequestSchema = z.object({
  operations: z.array(opSchema).min(1),
  idempotency_key: z.string().min(1).optional(),
});

interface CeApplyOutcome {
  status: number;
  body: unknown;
}

async function forwardToCe(
  backendUrl: string,
  jwt: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<CeApplyOutcome> {
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/operations/apply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { status: 503, body: { error: "store_unavailable" } };
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { status: 503, body: { error: "store_unavailable" } };
  }
  return { status: upstream.status, body: await upstream.json() };
}

/** CE-WRITE-1 canvas write proxy (TASK-023). AC-1/AC-2 (ADR-019): `actor`
 * is set server-side, verbatim, from the validated JWT's `principal_iri`
 * claim -- the proxy is the only writer of `actor`; a client-supplied
 * `actor` field is rejected outright (400), and a missing claim fails the
 * edit loud (401, no CE call) rather than falling back to `sub`. Every
 * other CE-WRITE-1 response (201, 422 SHACL, 403 role, 503) passes through
 * unchanged -- AC-7's server-side authz is CE's, this proxy adds no
 * redundant role gate. Reused by TASK-024/029 (unlocks). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (rawBody === null) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if ("actor" in rawBody) {
    return NextResponse.json({ error: "actor_forbidden" }, { status: 400 });
  }

  const parsed = applyRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const principal = getPrincipalIriClaim(session.accessToken);
  if (!principal) {
    return NextResponse.json({ error: "no_principal" }, { status: 401 });
  }

  const backendUrl = backendApiUrl();
  const outcome = await forwardToCe(
    backendUrl,
    session.accessToken,
    { ...parsed.data, actor: principal, target: "draft" },
    DEFAULT_EXPLORER_CONFIG.ceTimeoutMs
  );
  return NextResponse.json(outcome.body, { status: outcome.status });
}
