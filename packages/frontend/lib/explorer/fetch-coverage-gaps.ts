export interface CoverageGapRow {
  entityIri: string;
  missingLink: string;
}

export type FetchCoverageGapsResult = { type: "ok"; rows: CoverageGapRow[] } | { type: "error"; status: number };

interface CoverageGapResponseBody {
  rows: Array<{ entity_iri: string; missing_link: string }>;
}

/** AC-1/AC-2/AC-3: fetches CE-READ-1's `coverage_gap_process` pattern via
 * the same-origin `/api/proxy/sparql/coverage-gap` route (the client never
 * handles the JWT directly, nor composes the SPARQL itself -- CE owns the
 * rule). Never throws: every failure (HTTP error, network/timeout)
 * resolves to `{type: "error", status}` so the overlay can leave the
 * canvas untouched instead of crashing. */
export async function fetchCoverageGaps(timeoutMs: number): Promise<FetchCoverageGapsResult> {
  let response: Response;
  try {
    response = await fetch("/api/proxy/sparql/coverage-gap", { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return { type: "error", status: 0 };
  }

  if (!response.ok) return { type: "error", status: response.status };

  const body = (await response.json()) as CoverageGapResponseBody;
  return {
    type: "ok",
    rows: body.rows.map((row) => ({ entityIri: row.entity_iri, missingLink: row.missing_link })),
  };
}
