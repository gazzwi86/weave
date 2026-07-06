import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { NodeKind } from "@/lib/explorer/types";

export const runtime = "nodejs";

function lastSegment(iri: string): string {
  const segments = iri.split(/[/#]/).filter(Boolean);
  const segment = segments.length > 0 ? segments[segments.length - 1] : iri;
  return segment ?? iri;
}

interface BackendKindEntry {
  iri: string;
  label: string;
}

/** ponytail: every kind maps to the one design token that exists today
 * (`--color-kind-fallback` — see globals.css's own "M1 defer" note, full
 * 13-kind palette is OQ-08). Swap per-kind once those tokens land. */
function toNodeKind(entry: BackendKindEntry): NodeKind {
  return { id: lastSegment(entry.iri), label: entry.label, colour: "var(--color-kind-fallback)" };
}

/** AC-3: proxies CE-READ-1's BPMO kind catalogue (`GET /api/ontology/types`,
 * CE-READ-1 -- never a hand-copied list, `.claude/rules/ontology-standards.md`)
 * and adapts its `{kinds:[{iri,label,properties}]}` shape to the palette shape
 * the Explorer canvas expects (`{kinds:[{id,label,colour}]}`), attaching the
 * caller's session bearer token server-side (JWT never reaches client JS). */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/ontology/types`, {
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

  if (!upstream.ok) {
    const body = (await upstream.json()) as unknown;
    return NextResponse.json(body, { status: upstream.status });
  }

  const body = (await upstream.json()) as { kinds: BackendKindEntry[] };
  return NextResponse.json({ kinds: body.kinds.map(toNodeKind) }, { status: 200 });
}
