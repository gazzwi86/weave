import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { NodeKind, RelKind } from "@/lib/explorer/types";

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

interface BackendRelationshipEntry {
  path: string;
  name: string;
}

function toRelKind(entry: BackendRelationshipEntry): RelKind {
  return { id: lastSegment(entry.path), label: entry.name };
}

/** The 14 per-kind tokens from docs/standards/design/color.md (OQ-08 table)
 * live in globals.css as `--color-kind-<kindid lowercased>`; anything the
 * palette doesn't name falls back to the grey token. */
const KNOWN_KIND_TOKENS = new Set([
  "process", "activity", "event", "actor", "goal", "policy",
  "businessdomain", "businesscapability", "system", "service",
  "dataasset", "concept", "field", "class",
]);

function kindColour(id: string): string {
  const token = id.toLowerCase();
  return KNOWN_KIND_TOKENS.has(token)
    ? `var(--color-kind-${token})`
    : "var(--color-kind-fallback)";
}

function toNodeKind(entry: BackendKindEntry): NodeKind {
  const id = lastSegment(entry.iri);
  return { id, label: entry.label, colour: kindColour(id) };
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

  const body = (await upstream.json()) as { kinds: BackendKindEntry[]; relationships: BackendRelationshipEntry[] };
  return NextResponse.json(
    { kinds: body.kinds.map(toNodeKind), relTypes: body.relationships.map(toRelKind) },
    { status: 200 }
  );
}
