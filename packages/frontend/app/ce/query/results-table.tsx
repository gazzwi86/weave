import { DataTableSlot, type DataTableColumn, type DataTableRow } from "@/components/templates/DataTableSlot";

import type { QueryResult } from "./types";

function toColumns(columnNames: string[]): DataTableColumn[] {
  return columnNames.map((name) => ({ key: name, label: name }));
}

function toRows(result: QueryResult): DataTableRow[] {
  // ponytail: index-derived id is fine here -- rows are a read-only query
  // snapshot, never reordered/edited in place.
  return result.rows.map((row, index) => ({
    id: String(index),
    cells: Object.fromEntries(result.columnNames.map((name) => [name, row[name] ?? ""])),
  }));
}

/** CE-TASK-007 AC-007-13: renders the zero-gap message in place of an empty
 * table -- shared by the NL query, editor, and coverage_gap report results.
 * Composes the `DataTable` organism (via the app-layer-boundary-safe
 * `DataTableSlot`) instead of a hand-rolled `<table>`.
 */
export function ResultsTable({ result }: { result: QueryResult }) {
  if (result.rows.length === 0) {
    return (
      <p data-testid="results-empty" className="text-[var(--color-text-muted)]">
        {result.message ?? "No results found"}
      </p>
    );
  }

  return (
    <div data-testid="results-table">
      <DataTableSlot columns={toColumns(result.columnNames)} rows={toRows(result)} />
    </div>
  );
}
