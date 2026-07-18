import { DataTable, type DataTableColumn, type DataTableProps, type DataTableRow } from "@/components/organisms/DataTable";

export type { DataTableColumn, DataTableProps, DataTableRow };

/**
 * app/** import-boundary crossing (`weave/app-layer-boundary`): pages may
 * only reach `components/templates/**`, never a raw organism directly. Pass-
 * through so a page needing a bare data grid (no page header, unlike
 * `TablePage`) goes through one composed entry point.
 */
export function DataTableSlot(props: DataTableProps) {
  return <DataTable {...props} />;
}
