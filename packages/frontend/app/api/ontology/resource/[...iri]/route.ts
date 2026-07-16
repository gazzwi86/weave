import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// Law 13: the path segments and ?version= query are untrusted input.
const iriSegmentsSchema = z.array(z.string().min(1)).min(1);
const versionSchema = z.string().min(1).max(200).optional();

interface ResolvedPath {
  iriPath: string;
  versionQuery: string;
}

/** Complexity budget (Law E): isolates the two independent zod checks so
 * `GET` itself only has one branch per outcome.
 */
function resolvePath(iri: string[], versionParam: string | undefined): ResolvedPath | null {
  const parsedIri = iriSegmentsSchema.safeParse(iri);
  const parsedVersion = versionSchema.safeParse(versionParam);
  if (!parsedIri.success || !parsedVersion.success) {
    return null;
  }
  const versionQuery = parsedVersion.data
    ? `?version=${encodeURIComponent(parsedVersion.data)}`
    : "";
  return { iriPath: parsedIri.data.map(encodeURIComponent).join("/"), versionQuery };
}

/** TASK-006 AC-006-15: AI explanations link entity IRIs to this proxy;
 * AC-006-02/AC-006-09 use it to confirm a committed entity. `iri` is a
 * catch-all segment array (`[...iri]`) because IRIs contain `/` -- mirrors
 * the backend's `{iri:path}` converter. No `workspace_id` is ever accepted
 * from the client -- the backend derives it from the caller's session
 * (never client-supplied, per the CE-005 workspace-authz lesson).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ iri: string[] }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { iri } = await params;
  const resolved = resolvePath(iri, request.nextUrl.searchParams.get("version") ?? undefined);
  if (resolved === null) {
    return NextResponse.json({ error: "invalid_iri" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/api/ontology/resource/${resolved.iriPath}${resolved.versionQuery}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" }
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
