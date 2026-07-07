import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import type { GraphRow, SparqlPage } from "@/lib/explorer/types";

export const runtime = "nodejs";

// Law 13: query params are untrusted input -- validated via zod, never cast.
// This schema is also the AC-9 enforcement point: it only ever reads
// version/page from the querystring, so a `graph=` (or `query=`) override
// can never reach the outgoing fetch below -- the query text itself is
// always the fixed constant below, never client-supplied.
const sparqlQuerySchema = z.object({
  version: z.literal("latest"),
  page: z.coerce.number().int().min(0),
});

/** AC-1: the Explorer canvas's default load has no query of its own -- it
 * just wants every triple in the caller's graph. `GRAPH ?g` satisfies the
 * backend's GRAPH-scoped-query requirement (`rdf/query_rewriter.py`); the
 * actual tenant/workspace graph is bound at the protocol layer regardless
 * of what this text names (same module's docstring). */
const DEFAULT_GRAPH_QUERY =
  "SELECT ?subject ?predicate ?object WHERE { GRAPH ?g { ?subject ?predicate ?object } }";

interface BackendBinding {
  [variable: string]: { value: string };
}

interface BackendSparqlResponse {
  head: { vars: string[] };
  results: { bindings: BackendBinding[] };
}

/** Mirrors the backend's own `rdf/results.py::bindings_to_rows` -- an
 * unbound (e.g. OPTIONAL) column is simply absent from a row, never a
 * KeyError/undefined access. */
function bindingsToRows(bindings: BackendBinding[], columns: string[]): GraphRow[] {
  return bindings.map((binding) => {
    const row: Record<string, string> = {};
    for (const column of columns) {
      const value = binding[column]?.value;
      if (value !== undefined) row[column] = value;
    }
    return row as unknown as GraphRow;
  });
}

/** AC-1/AC-2: proxies one page of CE-READ-1's paginated SPARQL SELECT into
 * the Explorer canvas's expected `SparqlPage` shape, attaching the caller's
 * session bearer token server-side. CE-READ-1 scopes the named graph from
 * the JWT's tenant claim -- this route never adds a `graph=` override
 * (AC-9), and the query text is always the fixed constant above.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const parsed = sparqlQuerySchema.safeParse({
    version: request.nextUrl.searchParams.get("version"),
    page: request.nextUrl.searchParams.get("page") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  // Client pages are 0-indexed (fetch-graph.ts starts at page=0); CE-READ-1
  // pages are 1-indexed (`Query(default=1, ge=1)`, routers/sparql.py).
  const backendPage = parsed.data.page + 1;
  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  const upstreamUrl =
    `${backendUrl}/api/sparql?` +
    `query=${encodeURIComponent(DEFAULT_GRAPH_QUERY)}` +
    `&version=${parsed.data.version}&page=${backendPage}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
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

  const body = (await upstream.json()) as BackendSparqlResponse;
  const columns = body.head.vars;
  const page: SparqlPage = {
    rows: bindingsToRows(body.results.bindings, columns),
    columns,
    // AC-003-10: CE-READ-1 sets a `Link: rel="next"` header past 1000 rows
    // instead of a body field -- its presence is the only "more pages" signal.
    has_more_pages: upstream.headers.get("link") !== null,
    page: parsed.data.page,
  };
  return NextResponse.json(page, { status: 200 });
}

// Law 13: the POST body is untrusted input -- validated via zod, never cast.
const sparqlPostBodySchema = z.object({ query: z.string().min(1) });

interface SparqlTerm {
  value: string;
}

interface SparqlResultsBody {
  results: { bindings: Array<Record<string, SparqlTerm>> };
}

/** Reshapes Oxigraph's raw SPARQL 1.1 results JSON (`results.bindings`,
 * each value an `{type, value}` term) into the flat `{rows: [...]}` shape
 * the Explorer's fetch-domain-members.ts (and future traversal reads)
 * expect. */
function sparqlResultsToRows(body: SparqlResultsBody): Array<Record<string, string>> {
  return body.results.bindings.map((binding) =>
    Object.fromEntries(Object.entries(binding).map(([variable, term]) => [variable, term.value]))
  );
}

/** TASK-005 AC-1/AC-3: proxies a parameterised SPARQL SELECT (domain focus,
 * neighbour expansion) to the backend's real `POST /api/sparql`, attaching
 * the caller's session bearer token server-side. The backend resolves the
 * named graph from the JWT's tenant/workspace claim (AC-10) -- this route
 * never accepts a workspace_id or graph override from the request body. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const parsed = sparqlPostBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/sparql`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: parsed.data.query }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  const upstreamBody = (await upstream.json()) as unknown;
  if (!upstream.ok) {
    return NextResponse.json(upstreamBody, { status: upstream.status });
  }

  return NextResponse.json({ rows: sparqlResultsToRows(upstreamBody as SparqlResultsBody) }, { status: 200 });
}
