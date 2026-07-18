import { Badge } from "@/components/ui/badge";
import type { DataTableRow } from "@/components/templates/FilterableTablePage";
import type { GlossaryBrowseRow } from "@/lib/glossary/types";

export type GlossaryAlphaFilter = "all" | "a-f" | "g-m" | "n-s" | "t-z";

/** No CE-READ-1 field carries a corpus-wide term count, and the browse
 * query is a single 50-row SPARQL page with no COUNT companion query (see
 * `lib/glossary/build-browse-query.ts`) -- so both the alphabetic chips and
 * the search box below only ever see the currently loaded page, same
 * honest-placeholder discipline as `types-rows.ts`'s EMPTY_PLACEHOLDER. */
const DEFINITION_SNIPPET_LENGTH = 140;

const ALPHA_RANGES: Record<Exclude<GlossaryAlphaFilter, "all">, [string, string]> = {
  "a-f": ["A", "F"],
  "g-m": ["G", "M"],
  "n-s": ["N", "S"],
  "t-z": ["T", "Z"],
};

/** Resolves a related-term IRI to the loaded page's own label, falling back
 * to the IRI's last segment when the target isn't in the currently loaded
 * page (mirrors the old `glossary-row.tsx`'s `chipLabel`). */
export function labelByIri(rows: GlossaryBrowseRow[]): Map<string, string> {
  return new Map(rows.map((row) => [row.iri, row.prefLabel]));
}

function chipLabel(iri: string, labels: Map<string, string>): string {
  return labels.get(iri) ?? iri.split(/[/#:]/).filter(Boolean).pop() ?? iri;
}

function truncate(text: string): string {
  return text.length > DEFINITION_SNIPPET_LENGTH ? `${text.slice(0, DEFINITION_SNIPPET_LENGTH)}…` : text;
}

function matchesAlpha(prefLabel: string, filter: GlossaryAlphaFilter): boolean {
  if (filter === "all") return true;
  const letter = prefLabel.trim().charAt(0).toUpperCase();
  const [start, end] = ALPHA_RANGES[filter];
  return letter >= start && letter <= end;
}

function matchesSearch(row: GlossaryBrowseRow, search: string): boolean {
  if (!search.trim()) return true;
  const needle = search.trim().toLowerCase();
  return row.prefLabel.toLowerCase().includes(needle) || (row.definition ?? "").toLowerCase().includes(needle);
}

function RelatedChips({ row, labels }: { row: GlossaryBrowseRow; labels: Map<string, string> }) {
  const related = [...row.broaderIris, ...row.narrowerIris];
  if (related.length === 0) return <>—</>;
  return (
    <div className="flex flex-wrap gap-[var(--space-1)]">
      {related.map((iri) => (
        <Badge key={iri} variant="neutral">
          {chipLabel(iri, labels)}
        </Badge>
      ))}
    </div>
  );
}

function termRow(row: GlossaryBrowseRow, labels: Map<string, string>): DataTableRow {
  return {
    id: row.iri,
    cells: {
      term: (
        <span className="flex items-center gap-[var(--space-2)]">
          <b className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">{row.prefLabel}</b>
          {row.isOwlClass && <Badge variant="info">also class</Badge>}
        </span>
      ),
      definition: row.definition ? truncate(row.definition) : "—",
      related: <RelatedChips row={row} labels={labels} />,
    },
  };
}

/** Builds the active row set for an alphabetic-range + search combination,
 * both scoped to the currently loaded browse page (see the module doc
 * above). Kept outside `page.tsx` so it stays data-binding glue, not
 * filtering logic (Plugin Law E function-size/complexity budget). */
export function buildGlossaryRows(rows: GlossaryBrowseRow[], filter: GlossaryAlphaFilter, search: string): DataTableRow[] {
  const labels = labelByIri(rows);
  return rows.filter((row) => matchesAlpha(row.prefLabel, filter) && matchesSearch(row, search)).map((row) => termRow(row, labels));
}
