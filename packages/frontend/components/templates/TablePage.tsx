import type { ReactNode } from "react";

import { PageHeader } from "@/components/molecules/PageHeader";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/organisms/DataTable";

export interface TablePageProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  loading?: boolean;
  errorMessage?: string;
  selectedRowId?: string;
  onSelectRow?: (id: string) => void;
}

/** List/table page shell (`components.md` "Table"): page header top,
 * data grid below. Data-only props -- no fetch or routing here, the app
 * layer supplies `rows`/callbacks from live data. */
export function TablePage({
  title,
  subtitle,
  actions,
  columns,
  rows,
  loading,
  errorMessage,
  selectedRowId,
  onSelectRow,
}: TablePageProps) {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        errorMessage={errorMessage}
        selectedRowId={selectedRowId}
        onSelectRow={onSelectRow}
      />
    </div>
  );
}
