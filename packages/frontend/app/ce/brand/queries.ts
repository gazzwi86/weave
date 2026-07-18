import type { BrandStandardRow, VoiceRuleRow } from "./types";

const _PREFIX = "PREFIX weave: <https://weave.io/ontology/>";

// AC-004-03: paginated at 50/page. LIMIT 51 (one past the page size) lets
// the caller tell "more pages exist" apart from "exactly 50 total" without
// a second COUNT query -- same one-extra-row trick, applied client-side
// since this goes through the arbitrary-SELECT proxy (POST /api/proxy/sparql),
// not CE-READ-1's own paginated GET (which is reserved for Explorer's
// generic triple browse, not this UI -- see task brief's API Contracts).
const PAGE_SIZE = 50;

function offsetFor(page: number): number {
  return Math.max(0, Math.floor(page)) * PAGE_SIZE;
}

/** Reads individuals from the draft graph, not the CE-BRAND-1 projection
 * (task brief Design Decision: projections are Build's surface, and
 * reading them here would couple this UI's refresh to the projection
 * cache). Field list mirrors `brand/queries.py`'s TOKENS_QUERY, plus `?s`
 * (needed for attribution lookups and op batches; the backend's own
 * fixed queries never select it since their callers only need the
 * flattened token/rule shape).
 */
// Bodies run inside GRAPH ?g { ... } -- the backend's validate_query
// (packages/backend rdf/query_rewriter.py) rejects any SELECT/CONSTRUCT
// whose WHERE clause has no GRAPH pattern with unscoped_query_rejected
// (400), mirroring the glossary browse query's scoping.
export function standardsQuery(page: number): string {
  return `${_PREFIX}
SELECT ?s ?contentType ?contentBody ?sourceUri ?effectiveDate ?owner WHERE {
  GRAPH ?g {
    ?s a weave:BrandStandard ;
       weave:contentType ?contentType ;
       weave:effectiveDate ?effectiveDate ;
       weave:owner ?owner .
    OPTIONAL { ?s weave:contentBody ?contentBody }
    OPTIONAL { ?s weave:sourceUri ?sourceUri }
  }
}
ORDER BY ?s
LIMIT ${PAGE_SIZE + 1} OFFSET ${offsetFor(page)}
`;
}

export function voiceRulesQuery(page: number): string {
  return `${_PREFIX}
SELECT ?s ?ruleId ?severity ?assertion WHERE {
  GRAPH ?g {
    ?s a weave:VoiceRule ;
       weave:ruleId ?ruleId ;
       weave:severity ?severity ;
       weave:assertion ?assertion .
  }
}
ORDER BY ?s
LIMIT ${PAGE_SIZE + 1} OFFSET ${offsetFor(page)}
`;
}

/** Splits a raw `results.bindings`-derived row list into this page's rows
 * (`PAGE_SIZE`) + whether a next page exists, per the one-extra-row trick
 * above. */
export function paginate<T>(rows: T[]): { pageRows: T[]; hasMore: boolean } {
  return { pageRows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

// Flat string row -- the real shape POST /api/proxy/sparql returns
// (`{ rows: [{ variable: "value" }] }`, already reshaped server-side from
// Oxigraph's raw `{ value }` term bindings -- see route.ts's
// sparqlResultsToRows and lib/explorer/fetch-domain-members.ts's identical
// consumption), never a raw term-wrapper shape.
interface SparqlRow {
  [variable: string]: string | undefined;
}

function rowValue(row: SparqlRow, key: string): string | null {
  return row[key] ?? null;
}

export function toStandardRow(row: SparqlRow): BrandStandardRow {
  return {
    iri: rowValue(row, "s") ?? "",
    contentType: rowValue(row, "contentType") ?? "",
    contentBody: rowValue(row, "contentBody"),
    sourceUri: rowValue(row, "sourceUri"),
    effectiveDate: rowValue(row, "effectiveDate") ?? "",
    owner: rowValue(row, "owner") ?? "",
  };
}

export function toVoiceRuleRow(row: SparqlRow): VoiceRuleRow {
  return {
    iri: rowValue(row, "s") ?? "",
    ruleId: rowValue(row, "ruleId") ?? "",
    severity: rowValue(row, "severity") === "critical" ? "critical" : "normal",
    assertion: rowValue(row, "assertion") ?? "",
  };
}
