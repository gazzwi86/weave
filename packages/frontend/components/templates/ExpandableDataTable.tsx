import { DataTable, type DataTableProps } from "@/components/organisms/DataTable";

export type { DataTableColumn, DataTableRow, DataTableExpandable } from "@/components/organisms/DataTable";

/** Pass-through template (`TablePage`/`InstanceBrowserPage`'s sibling) for
 * pages that need `DataTable`'s expandable-row affordance without a
 * `PageHeader` -- the app-layer boundary rule (`lint-import-boundary.ts`)
 * requires app/** to reach `DataTable` through a template, not directly. */
export function ExpandableDataTable(props: DataTableProps) {
  return <DataTable {...props} />;
}
