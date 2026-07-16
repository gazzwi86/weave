import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: path param is untrusted input -- validated via zod, never cast.
// version_iri is a full IRI (urn: or https:, contains "/" and ":"), so a
// non-empty-string check is used rather than z.string().url() (which would
// reject a bare urn: scheme in some environments).
const iriSchema = z.string().min(1);

/** Proxies CE-READ-1's `POST /api/ontology/versions/{version_iri}/publish`.
 * The upstream status/body is passed through unchanged (200 published,
 * 403 insufficient role, 404 version_not_found, 405 already-published) --
 * the client decides what each means, this route only forwards.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ iri: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { iri } = await params;
  const parsed = iriSchema.safeParse(iri);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_version_iri" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/ontology/versions/${encodeURIComponent(parsed.data)}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}
