import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getCognitoRoleClaim } from "@/lib/explorer/get-cognito-role-claim";
import { stripLangTag } from "@/lib/explorer/strip-lang-tag";

export const runtime = "nodejs";

interface KeyProperty {
  path: string;
  label: string;
  value: string;
}

interface CeResourceBody {
  label: string;
  type_label: string;
  bpmo_kind?: string;
  key_properties: KeyProperty[];
}

// Law 13: the path param is untrusted input -- validated via zod, never cast.
const iriSchema = z.string().url();

function stripLangTags(body: CeResourceBody): CeResourceBody {
  return {
    ...body,
    label: stripLangTag(body.label),
    type_label: stripLangTag(body.type_label),
    key_properties: body.key_properties.map((property) => ({ ...property, value: stripLangTag(property.value) })),
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

  return { type: "ok", body: (await upstream.json()) as CeResourceBody };
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

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  const outcome = await fetchUpstreamResource(backendUrl, parsed.data, session.accessToken);
  if (outcome.type === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (outcome.type === "unavailable") {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  const body = stripLangTags(outcome.body);
  const role = getCognitoRoleClaim(session.accessToken);
  return NextResponse.json({ ...body, raw_iri: role === "ontologist" ? parsed.data : null });
}
