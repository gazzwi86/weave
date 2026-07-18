"use client";

import type { ReactNode } from "react";

import {
  DataTable,
  DataTableNameCell,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/organisms/DataTable";
import { EntityEditDrawer, type EntityEditDrawerProps } from "@/components/organisms/EntityEditDrawer";
import { KindChip, type BpmoKind } from "@/components/molecules/KindChip";
import { ErrorCard } from "@/components/ui/error-card";
import { FilterBar, type FilterBarProps } from "@/components/ui/filter-bar";
import type { PaginationProps } from "@/components/ui/pagination";

export { DataTableNameCell };
export type { DataTableColumn, DataTableRow, BpmoKind };

/** Kind-chip cell (`app_layer_boundary` -- app/** may not import `KindChip`
 * directly). Distinct from `InstanceBrowserPage`'s `KindCell`, which always
 * renders an empty label; this one carries the kind's own label since the
 * Types catalogue has no separate name column. */
export function KindCell({ kind, label }: { kind: BpmoKind; label: string }) {
  return <KindChip kind={kind} label={label} />;
}

export interface FilterableTablePageProps {
  filterBar: FilterBarProps;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  loading?: boolean;
  renderRowActions?: (row: DataTableRow) => ReactNode;
  pagination?: PaginationProps;
  /** Present -> table area renders `ErrorCard` instead of `DataTable`. */
  error?: { title: string; body: string; onRetry: () => void };
  /** Present -> `EntityEditDrawer` renders alongside the table (its own
   * `open` prop controls visibility). */
  drawer?: EntityEditDrawerProps;
}

/** Filter chips/search over a data table, with an optional entity edit
 * drawer -- the shape shared by the Ontology/Types and Glossary screens
 * (`refit-mock.html` `#sub-types`/`#sub-glossary`). Data-only props, no
 * fetch or routing here; the app layer binds live data and drawer state. */
export function FilterableTablePage({
  filterBar,
  columns,
  rows,
  loading,
  renderRowActions,
  pagination,
  error,
  drawer,
}: FilterableTablePageProps) {
  return (
    <>
      <FilterBar {...filterBar} />
      {error ? (
        <ErrorCard title={error.title} body={error.body} onRetry={error.onRetry} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          renderRowActions={renderRowActions}
          pagination={pagination}
        />
      )}
      {drawer && <EntityEditDrawer {...drawer} />}
    </>
  );
}
