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
  raw_iri?: string | null;
}

// CE-READ-1's real `GET /api/ontology/resource/{iri}` shape (schemas/ontology.py's
// ResourceResponse) -- NOT the panel shape below. The two were previously
// conflated (this route parsed the upstream body as if it were already
// panel-shaped), so `stripLangTags` threw on every real request
// (`key_properties` doesn't exist upstream) and every node click collapsed
// to a 503 "Details unavailable". `toPanelBody` below is the fix: an
// explicit mapping step between the two shapes.
interface OntologyTriple {
  subject: string;
  predicate: string;
  object: string;
}

interface OntologyOutgoingEdge {
  predicate: string;
  target: string;
}

interface OntologyIncomingEdge {
  predicate: string;
  source: string;
}

interface OntologyResourceBody {
  iri: string;
  kind: string | null;
  label: string;
  version_iri: string;
  triples: OntologyTriple[];
  outgoing: OntologyOutgoingEdge[];
  incoming: OntologyIncomingEdge[];
}

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

// Law 13: the path param is untrusted input -- validated via zod, never cast.
const iriSchema = z.string().url();

function localName(iri: string): string {
  const hashIndex = iri.lastIndexOf("#");
  const slashIndex = iri.lastIndexOf("/");
  return iri.slice(Math.max(hashIndex, slashIndex) + 1);
}

/** Self-attribute triples only. CE-READ-1's resource.py appends every self
 * triple to `triples` unconditionally -- including the `rdf:type` triple and
 * the label triple -- so without excluding them, an edit-and-save round trip
 * (use-panel-edit.ts -> update_node) would rewrite the node's type/label as
 * a plain string literal. Also excludes any triple whose (predicate, object)
 * already appears in `outgoing`: those are relationship edges, not scalar
 * properties. */
function toKeyProperties(body: OntologyResourceBody): KeyProperty[] {
  const edgeKeys = new Set(body.outgoing.map((edge) => `${edge.predicate}|${edge.target}`));
  return body.triples
    .filter((triple) => triple.subject === body.iri)
    .filter((triple) => triple.predicate !== RDF_TYPE)
    .filter((triple) => localName(triple.predicate) !== "label")
    .filter((triple) => !edgeKeys.has(`${triple.predicate}|${triple.object}`))
    .map((triple) => ({ path: triple.predicate, label: localName(triple.predicate), value: triple.object }));
}

/** Neighbour label/kind are a genuine CE-READ-1 data gap -- edges carry only
 * `predicate` + `target`/`source`, no label or kind for the neighbour node
 * itself. Falls back to the IRI's local name and an empty kind; harmless for
 * the delete flow (edit-controller.ts's buildDeleteOps needs only
 * predicate/iri/direction), only expand-render cosmetics (node icon/label)
 * degrade until CE-READ-1 embeds neighbour summaries. */
function toNeighbours(body: OntologyResourceBody): CeResourceNeighbourBody[] {
  return [
    ...body.outgoing.map((edge) => ({
      iri: edge.target,
      label: localName(edge.target),
      bpmo_kind: "",
      edge_predicate: edge.predicate,
      edge_direction: "outgoing" as const,
    })),
    ...body.incoming.map((edge) => ({
      iri: edge.source,
      label: localName(edge.source),
      bpmo_kind: "",
      edge_predicate: edge.predicate,
      edge_direction: "incoming" as const,
    })),
  ];
}

/** Maps CE-READ-1's real resource shape to the panel shape
 * fetch-node-props.ts expects (label/type_label/bpmo_kind/key_properties/
 * neighbours). This is the single choke point for the mismatch -- see the
 * interface comments above. */
function toPanelBody(body: OntologyResourceBody): CeResourceBody {
  return {
    label: body.label,
    type_label: body.kind ?? "",
    bpmo_kind: body.kind ?? undefined,
    key_properties: toKeyProperties(body),
    neighbours: toNeighbours(body),
  };
}

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
  // validation in toPanelBody/stripLangTags (unexpected upstream shape).
  // Either throw must collapse to the same "unavailable" outcome as a bad
  // status code, not escape as an uncaught exception -- Next.js renders
  // those as a raw 500 with no body, which is indistinguishable from a real
  // outage.
  try {
    const body = (await upstream.json()) as OntologyResourceBody;
    return { type: "ok", body: stripLangTags(toPanelBody(body)) };
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
