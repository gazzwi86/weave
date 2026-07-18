import type { ReactNode } from "react";

import { PageHeader } from "@/components/molecules/PageHeader";
import { DataTable, type DataTableColumn, type DataTableProps, type DataTableRow } from "@/components/organisms/DataTable";

export interface TablePageProps {
  title: string;
  titleTrailing?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  /** Optional `FilterBar` (or similar) rendered between the header and the
   * table -- e.g. Settings -> Members' search+chip row. */
  filterBar?: ReactNode;
  /** Rendered between the header and the table -- e.g. an ExplainBand +
   * StatCards row on the operator console (refit-mock.html `#screen-operator`
   * order is header, then band, then KPIs, then table). When both `banner`
   * and `filterBar` are set, the banner renders first. */
  banner?: ReactNode;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  loading?: boolean;
  errorMessage?: string;
  selectedRowId?: string;
  onSelectRow?: (id: string) => void;
  /** Passed straight through to `DataTable` -- hover-reveal row actions. */
  renderRowActions?: DataTableProps["renderRowActions"];
}

/** List/table page shell (`components.md` "Table"): page header top,
 * data grid below. Data-only props -- no fetch or routing here, the app
 * layer supplies `rows`/callbacks from live data. */
export function TablePage({
  title,
  titleTrailing,
  subtitle,
  actions,
  filterBar,
  banner,
  columns,
  rows,
  loading,
  errorMessage,
  selectedRowId,
  onSelectRow,
  renderRowActions,
}: TablePageProps) {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <PageHeader title={title} titleTrailing={titleTrailing} subtitle={subtitle} actions={actions} />
      {banner}
      {filterBar}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        errorMessage={errorMessage}
        selectedRowId={selectedRowId}
        onSelectRow={onSelectRow}
        renderRowActions={renderRowActions}
      />
    </div>
  );
}
