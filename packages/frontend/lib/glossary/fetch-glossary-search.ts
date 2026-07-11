import { buildGlossarySearchQuery } from "./build-search-query";
import type { GlossaryFetchResult, GlossaryTermRow } from "./types";

interface RawGlossaryRow {
  iri: string;
  prefLabel: string;
  definition?: string;
  owlRole: string;
}

interface GlossarySearchResponseBody {
  rows: RawGlossaryRow[];
}

function toTermRow(row: RawGlossaryRow): GlossaryTermRow {
  return {
    iri: row.iri,
    prefLabel: row.prefLabel,
    definition: row.definition ?? null,
    isOwlClass: row.owlRole === "true",
  };
}

/** AC-002-01: fetches glossary search results via the existing CE-READ-1
 * proxy (`/api/proxy/sparql` POST) -- no new backend endpoint. Never
 * throws: every failure (HTTP error, network/timeout) resolves to
 * `{type: "error", status}` so the search UI can render a fallback. */
export async function fetchGlossarySearch(
  term: string,
  timeoutMs: number
): Promise<GlossaryFetchResult<GlossaryTermRow>> {
  const query = buildGlossarySearchQuery(term);

  let response: Response;
  try {
    response = await fetch("/api/proxy/sparql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { type: "error", status: 0 };
  }

  if (!response.ok) return { type: "error", status: response.status };

  const body = (await response.json()) as GlossarySearchResponseBody;
  return { type: "ok", rows: body.rows.map(toTermRow) };
}
