import { cn } from "@/lib/utils";

export interface DataTableColumn {
  key: string;
  label: string;
}

export interface DataTableRow {
  id: string;
  /** Cell text keyed by column key -- pre-formatted by the caller. */
  cells: Record<string, string>;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  loading?: boolean;
  errorMessage?: string;
  selectedRowId?: string;
  onSelectRow?: (id: string) => void;
  className?: string;
}

/** Single-message row shared by the loading/empty/error states. */
function DataTableStatusRow({ colSpan, message, tone, busy }: { colSpan: number; message: string; tone: "muted" | "danger"; busy?: boolean }) {
  return (
    <tr aria-busy={busy || undefined}>
      <td
        colSpan={colSpan}
        className={cn(
          "px-[var(--space-3)] py-[var(--space-4)] text-[length:var(--text-body-sm)]",
          tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"
        )}
      >
        {message}
      </td>
    </tr>
  );
}

function DataTableBody({
  columns,
  rows,
  loading,
  errorMessage,
  selectedRowId,
  onSelectRow,
}: Omit<DataTableProps, "className">) {
  if (errorMessage) {
    return <DataTableStatusRow colSpan={columns.length} message={errorMessage} tone="danger" />;
  }
  if (loading) {
    return <DataTableStatusRow colSpan={columns.length} message="Loading..." tone="muted" busy />;
  }
  if (rows.length === 0) {
    return <DataTableStatusRow colSpan={columns.length} message="No rows." tone="muted" />;
  }
  return (
    <>
      {rows.map((row) => (
        <tr
          key={row.id}
          aria-selected={row.id === selectedRowId || undefined}
          onClick={() => onSelectRow?.(row.id)}
          className={cn(
            "cursor-pointer border-t border-[var(--color-border)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]",
            row.id === selectedRowId && "bg-[var(--color-accent-soft)]"
          )}
        >
          {columns.map((column) => (
            <td key={column.key} className="px-[var(--space-3)] py-[var(--space-2)]">
              {row.cells[column.key]}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Flat data grid -- `--color-surface` family, no blur (`components.md`
 * "Glass vs flat": DataTable stays flat). */
export function DataTable({ columns, rows, loading, errorMessage, selectedRowId, onSelectRow, className }: DataTableProps) {
  return (
    <table
      className={cn(
        "w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        className
      )}
    >
      <thead>
        <tr className="border-b border-[var(--color-border)] text-[length:var(--text-overline)] tracking-[var(--text-overline-tracking)] text-[var(--color-text-muted)]">
          {columns.map((column) => (
            <th key={column.key} className="px-[var(--space-3)] py-[var(--space-2)] text-left">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <DataTableBody
          columns={columns}
          rows={rows}
          loading={loading}
          errorMessage={errorMessage}
          selectedRowId={selectedRowId}
          onSelectRow={onSelectRow}
        />
      </tbody>
    </table>
  );
}
