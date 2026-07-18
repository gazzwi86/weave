import { Badge } from "@/components/ui/badge";
import { DataTableNameCell, KindCell, type BpmoKind, type DataTableRow } from "@/components/templates/FilterableTablePage";

import type { KindEntry, PropertyShape } from "../chat/types";
import { kindId } from "./use-types";

export type TypesCategory = "all" | "framework" | "extensions" | "relationships";

/** All catalogue kinds are framework kinds in M1 (`list_kinds()` only ever
 * returns the fixed BPMO_KINDS set — no extension-kind concept exists yet
 * server-side), so "Origin" is truthfully "Framework" for every row rather
 * than a fabricated value; the Extensions filter is truthfully always
 * empty until extension kinds ship. No CE-READ-1 field carries a per-kind
 * instance count either -- "Instances" renders "—" rather than inventing
 * one (keeping the reshape-only scope of this refit: CE-READ-1 stays the
 * only fetch, `entity_count_by_kind` lives on CE-METRICS-1 instead). */
const EMPTY_PLACEHOLDER = "—";

function kindRow(kind: KindEntry): DataTableRow {
  return {
    id: kind.iri,
    cells: {
      kind: <KindCell kind={kindId(kind.iri).toLowerCase() as BpmoKind} label={kind.label} />,
      description: kind.description || EMPTY_PLACEHOLDER,
      instances: EMPTY_PLACEHOLDER,
      origin: <Badge variant="neutral">Framework</Badge>,
    },
  };
}

function relationshipRow(rel: PropertyShape): DataTableRow {
  return {
    id: rel.path,
    cells: {
      kind: <DataTableNameCell label={rel.name} id={rel.path} />,
      description: `${rel.min_count ?? 0}..${rel.max_count ?? "*"}`,
      instances: EMPTY_PLACEHOLDER,
      origin: <Badge variant="neutral">Framework</Badge>,
    },
  };
}

function matchesSearch(haystack: (string | null | undefined)[], search: string): boolean {
  if (!search.trim()) return true;
  const needle = search.trim().toLowerCase();
  return haystack.some((value) => value?.toLowerCase().includes(needle));
}

/** Builds the active row set for a category + search combination. Kept
 * outside the page component so `page.tsx` stays data-binding glue, not
 * filtering logic (Plugin Law E function-size/complexity budget). */
export function buildTypeRows(
  kinds: KindEntry[],
  relationships: PropertyShape[],
  category: TypesCategory,
  search: string
): DataTableRow[] {
  if (category === "extensions") return [];
  if (category === "relationships") {
    return relationships
      .filter((rel) => matchesSearch([rel.name, rel.path], search))
      .map(relationshipRow);
  }
  return kinds.filter((kind) => matchesSearch([kind.label, kind.description], search)).map(kindRow);
}
