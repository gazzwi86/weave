import type { SparqlPage } from "@/lib/explorer/types";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const ONTOLOGY_PREFIX = "https://weave.io/ontology/";
/** Sane cap on CE-READ-1 pages pulled for a stats read (fetch-graph.ts
 * bounds by node count instead; a count-only page needs far less). */
const MAX_PAGES = 10;

export interface TripleTally {
  /** Instance count per kind id, from rdf:type triples. */
  countsByKind: Record<string, number>;
  totalTriples: number;
}

/** Pages CE-READ-1 triples, tallying rdf:type instances per BPMO kind.
 * Shared by the Overview widget (`use-overview.ts`) and the Types page
 * Instances column (`types/use-type-counts.ts`) -- one tally, two
 * consumers, so the count logic never drifts between the two views. */
export async function tallyTriples(): Promise<TripleTally> {
  const countsByKind: Record<string, number> = {};
  let totalTriples = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetch(`/api/proxy/sparql?version=latest&page=${page}`);
    // A workspace with no published version yet 404s on `latest` -- that is
    // an EMPTY model, not a failure (fresh workspace after a switch).
    if (response.status === 404) break;
    if (!response.ok) throw new Error(`overview_fetch_failed_${response.status}`);
    const data = (await response.json()) as SparqlPage;
    totalTriples += data.rows.length;
    for (const row of data.rows) {
      if (row.predicate !== RDF_TYPE || !row.object.startsWith(ONTOLOGY_PREFIX)) continue;
      const kindId = row.object.slice(ONTOLOGY_PREFIX.length);
      countsByKind[kindId] = (countsByKind[kindId] ?? 0) + 1;
    }
    if (!data.has_more_pages) break;
  }
  return { countsByKind, totalTriples };
}
