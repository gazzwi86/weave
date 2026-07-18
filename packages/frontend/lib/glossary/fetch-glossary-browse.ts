import { buildGlossaryBrowseQuery } from "./build-browse-query";
import type { GlossaryBrowseRow, GlossaryFetchResult } from "./types";

interface RawGlossaryBrowseRow {
  iri: string;
  prefLabel: string;
  definition?: string;
  owlRole: string;
  broader?: string;
  narrower?: string;
}

interface GlossaryBrowseResponseBody {
  rows: RawGlossaryBrowseRow[];
}

/** `GROUP_CONCAT(...; separator="|")` yields `""` when no relationship
 * exists, but the SPARQL proxy omits an unbound GROUP_CONCAT column
 * entirely (no key at all), so `value` can also be `undefined`. Splitting
 * an empty string would produce `[""]`, one phantom chip -- both the
 * empty and absent cases are guarded explicitly. */
function splitChipIris(value: string | undefined): string[] {
  return value ? value.split("|") : [];
}

function toBrowseRow(row: RawGlossaryBrowseRow): GlossaryBrowseRow {
  return {
    iri: row.iri,
    prefLabel: row.prefLabel,
    definition: row.definition ?? null,
    isOwlClass: row.owlRole === "true",
    broaderIris: splitChipIris(row.broader),
    narrowerIris: splitChipIris(row.narrower),
  };
}

/** AC-002-03: fetches one 50-row browse page via the existing CE-READ-1
 * proxy (`/api/proxy/sparql` POST) -- no new backend endpoint. Never
 * throws: every failure resolves to `{type: "error", status}`. */
export async function fetchGlossaryBrowse(
  page: number,
  timeoutMs: number
): Promise<GlossaryFetchResult<GlossaryBrowseRow>> {
  const query = buildGlossaryBrowseQuery(page);

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

  const body = (await response.json()) as GlossaryBrowseResponseBody;
  return { type: "ok", rows: body.rows.map(toBrowseRow) };
}
