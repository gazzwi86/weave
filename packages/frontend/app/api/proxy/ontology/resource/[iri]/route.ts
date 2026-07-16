import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";
import { getCognitoRoleClaim } from "@/lib/explorer/get-cognito-role-claim";
import { stripLangTag } from "@/lib/explorer/strip-lang-tag";

export const runtime = "nodejs";

interface KeyProperty {
  path: string;
  label: string;
  value: string;
}

interface CeResourceNeighbourBody {
  iri: string;
  label: string;
  bpmo_kind: string;
  edge_predicate: string;
  edge_direction: "outgoing" | "incoming";
}

interface CeResourceBody {
  label: string;
  type_label: string;
  bpmo_kind?: string;
  key_properties: KeyProperty[];
  neighbours?: CeResourceNeighbourBody[];
}

// Law 13: the path param is untrusted input -- validated via zod, never cast.
const iriSchema = z.string().url();

function stripLangTags(body: CeResourceBody): CeResourceBody {
  return {
    ...body,
    label: stripLangTag(body.label),
    type_label: stripLangTag(body.type_label),
    key_properties: body.key_properties.map((property) => ({ ...property, value: stripLangTag(property.value) })),
    neighbours: (body.neighbours ?? []).map((neighbour) => ({ ...neighbour, label: stripLangTag(neighbour.label) })),
  };
}

type UpstreamOutcome = { type: "ok"; body: CeResourceBody } | { type: "not_found" } | { type: "unavailable" };

// AC-8: never read/surface the upstream 404 body -- cross-tenant and
// genuinely-missing resources both collapse to the same generic outcome.
async function fetchUpstreamResource(backendUrl: string, iri: string, accessToken: string): Promise<UpstreamOutcome> {
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/ontology/resource/${encodeURIComponent(iri)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { type: "unavailable" };
  }

  if (upstream.status === 404) return { type: "not_found" };

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.includes("application/json")) return { type: "unavailable" };

  // Known issue (intermittent 500/empty-body): a 2xx + json content-type
  // response can still fail to parse (malformed body) or fail shape
  // validation in stripLangTags (unexpected upstream shape). Either throw
  // must collapse to the same "unavailable" outcome as a bad status code,
  // not escape as an uncaught exception -- Next.js renders those as a raw
  // 500 with no body, which is indistinguishable from a real outage.
  try {
    const body = (await upstream.json()) as CeResourceBody;
    return { type: "ok", body: stripLangTags(body) };
  } catch {
    return { type: "unavailable" };
  }
}

/** AC-2/AC-8: proxies CE-READ-1's `GET /api/ontology/resource/{iri}`,
 * attaching the caller's session bearer token server-side and deciding
 * raw-IRI disclosure from the JWT's `role` claim (never a client flag). A
 * 404 (including cross-tenant) is normalised to `{error: "not_found"}` --
 * the upstream body is never read, so it can never leak into a log or a
 * response. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ iri: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { iri } = await params;
  const parsed = iriSchema.safeParse(iri);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_iri" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  const outcome = await fetchUpstreamResource(backendUrl, parsed.data, session.accessToken);
  if (outcome.type === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (outcome.type === "unavailable") {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  const role = getCognitoRoleClaim(session.accessToken);
  return NextResponse.json({ ...outcome.body, raw_iri: role === "ontologist" ? parsed.data : null });
}
