import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

export const runtime = "nodejs";

// FR-044: optional pre-ingestion context fields the extraction prompt
// interpolates (AC-002-07) -- the only fields whitelisted through to the
// backend besides the file itself (Law 13: untrusted multipart input, so no
// arbitrary field forwarding).
const CONTEXT_FIELDS = ["source_system", "owner", "date_of_truth", "sensitivity", "context"];

function buildOutgoingForm(incoming: FormData, file: File): FormData {
  const outgoing = new FormData();
  outgoing.set("file", file);
  for (const field of CONTEXT_FIELDS) {
    const value = incoming.get(field);
    if (typeof value === "string" && value.length > 0) outgoing.set(field, value);
  }
  return outgoing;
}

/** Turns a backend fetch (or its absence/non-JSON shape) into the
 * NextResponse this route returns -- split out purely to keep `POST`
 * under the Law E complexity budget.
 */
async function relayUpstream(upstream: Response | null): Promise<NextResponse> {
  if (upstream === null) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  const body = (await upstream.json()) as unknown;
  return NextResponse.json(body, { status: upstream.status });
}

/** TASK-013 E12-S1: proxies the chat panel's document upload to
 * `POST /api/ingest/artefacts`, forwarding the multipart body as-is so the
 * backend's own `UploadFile`/`Form(...)` parsing does the real validation.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const incoming = await request.formData().catch(() => null);
  const file = incoming?.get("file");
  if (!incoming || !(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const backendUrl = backendApiUrl();
  const upstream = await fetch(`${backendUrl}/api/ingest/artefacts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
    body: buildOutgoingForm(incoming, file),
    cache: "no-store",
  }).catch(() => null);

  return relayUpstream(upstream);
}
