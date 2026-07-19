import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

import { Pagination, type PaginationProps } from "../ui/pagination";

export interface DataTableColumn {
  key: string;
  label: string;
}

export interface DataTableRow {
  id: string;
  /** Cell content keyed by column key -- pre-formatted by the caller. A
   * plain string for text cells; a `ReactNode` for a cell that composes
   * another dumb component (e.g. `KindChip` for a "kind" column, TASK-031
   * AC-1; `DataTableNameCell` for a name+mono-id cell, refit-mock.html
   * line ~2764; or action buttons like Invite/Revoke, TASK-030 AC-2) --
   * still caller-supplied, DataTable itself never fetches. */
  cells: Record<string, ReactNode>;
}

/** Expandable-row config (refit-mock.html `.viol-row`/`.log-expand`) --
 * controlled by the caller: DataTable only renders the toggle affordance
 * and the detail row when `expandedRowId` matches. */
export interface DataTableExpandable {
  expandedRowId: string | null;
  onToggleRow: (id: string) => void;
  renderDetail: (row: DataTableRow) => ReactNode;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  loading?: boolean;
  errorMessage?: string;
  selectedRowId?: string;
  onSelectRow?: (id: string) => void;
  /** Hover-reveal actions column (refit-mock.html `.row-actions`). */
  renderRowActions?: (row: DataTableRow) => ReactNode;
  expandable?: DataTableExpandable;
  /** Integrated footer -- reuses `Pagination`'s own prop shape. */
  pagination?: PaginationProps;
  className?: string;
}

/** Stacked name+mono-id cell (refit-mock.html's DataTable name column --
 * bold label over a `display:block` mono sub-id). Distinct from `EntityRef`,
 * which lays label+id out inline; this variant is a DataTable cell value,
 * not a general-purpose atom. */
export interface DataTableNameCellProps {
  label: string;
  id: string;
  className?: string;
}

export function DataTableNameCell({ label, id, className }: DataTableNameCellProps) {
  return (
    <span className={cn("flex flex-col gap-[var(--space-1)]", className)}>
      <strong className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">{label}</strong>
      <span className="font-[var(--font-mono)] text-[length:var(--text-mono-sm)] text-[var(--color-text-subtle)]">
        {id}
      </span>
    </span>
  );
}

/** Single-message row shared by the loading/empty/error states. */
function DataTableStatusRow({
  colSpan,
  message,
  tone,
  busy,
}: {
  colSpan: number;
  message: string;
  tone: "muted" | "danger";
  busy?: boolean;
}) {
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

type DataTableBodyProps = Pick<
  DataTableProps,
  "columns" | "rows" | "loading" | "errorMessage" | "selectedRowId" | "onSelectRow" | "renderRowActions" | "expandable"
>;

/** Column count spanned by a status/detail row -- the base columns plus
 * whichever optional trailing columns (actions, expand chevron) are active. */
function colSpanFor({ columns, renderRowActions, expandable }: Pick<DataTableBodyProps, "columns" | "renderRowActions" | "expandable">) {
  return columns.length + (renderRowActions ? 1 : 0) + (expandable ? 1 : 0);
}

function DataTableRowActionsCell({ row, renderRowActions }: { row: DataTableRow; renderRowActions: NonNullable<DataTableProps["renderRowActions"]> }) {
  return (
    <td className="px-[var(--space-3)] py-[var(--space-2)]">
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex justify-end gap-[var(--space-1)] opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100"
      >
        {renderRowActions(row)}
      </div>
    </td>
  );
}

function DataTableDetailRow({ row, colSpan, expandable }: { row: DataTableRow; colSpan: number; expandable: DataTableExpandable }) {
  if (expandable.expandedRowId !== row.id) return null;
  return (
    <tr data-testid={`table-row-detail-${row.id}`}>
      <td colSpan={colSpan} className="bg-[var(--color-raised)] p-0">
        <div className="flex flex-col gap-[var(--space-2)] py-[var(--space-4)] pr-[var(--space-4)] pl-[var(--space-8)]">
          {expandable.renderDetail(row)}
        </div>
      </td>
    </tr>
  );
}

type DataTableDataRowProps = { row: DataTableRow } & Omit<DataTableBodyProps, "loading" | "errorMessage" | "rows">;

/** Row click toggles expand when the row is expandable; otherwise it
 * selects, if the caller wired `onSelectRow` -- the two behaviours don't
 * apply to the same row at once. */
function rowClickHandler(row: DataTableRow, expandable?: DataTableExpandable, onSelectRow?: (id: string) => void) {
  if (expandable) return () => expandable.onToggleRow(row.id);
  if (onSelectRow) return () => onSelectRow(row.id);
  return undefined;
}

function DataTableDataRow({ row, columns, selectedRowId, onSelectRow, renderRowActions, expandable }: DataTableDataRowProps) {
  const clickHandler = rowClickHandler(row, expandable, onSelectRow);
  return (
    <>
      <tr
        data-testid={`table-row-${row.id}`}
        aria-selected={row.id === selectedRowId || undefined}
        onClick={clickHandler}
        className={cn(
          "group border-t border-[var(--color-border)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]",
          clickHandler && "cursor-pointer",
          row.id === selectedRowId && "bg-[var(--color-accent-soft)]"
        )}
      >
        {expandable && (
          <td className="w-[var(--space-6)] px-[var(--space-2)] py-[var(--space-2)]">
            <span
              className={cn(
                "inline-flex transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]",
                expandable.expandedRowId === row.id && "rotate-90"
              )}
            >
              &rsaquo;
            </span>
          </td>
        )}
        {columns.map((column) => (
          <td key={column.key} className="px-[var(--space-3)] py-[var(--space-2)]">
            {row.cells[column.key]}
          </td>
        ))}
        {renderRowActions && <DataTableRowActionsCell row={row} renderRowActions={renderRowActions} />}
      </tr>
      {expandable && (
        <DataTableDetailRow row={row} colSpan={colSpanFor({ columns, renderRowActions, expandable })} expandable={expandable} />
      )}
    </>
  );
}

function DataTableBody({ columns, rows, loading, errorMessage, selectedRowId, onSelectRow, renderRowActions, expandable }: DataTableBodyProps) {
  const colSpan = colSpanFor({ columns, renderRowActions, expandable });
  if (errorMessage) {
    return <DataTableStatusRow colSpan={colSpan} message={errorMessage} tone="danger" />;
  }
  if (loading) {
    return <DataTableStatusRow colSpan={colSpan} message="Loading..." tone="muted" busy />;
  }
  if (rows.length === 0) {
    return <DataTableStatusRow colSpan={colSpan} message="No rows." tone="muted" />;
  }
  return (
    <>
      {rows.map((row) => (
        <DataTableDataRow
          key={row.id}
          row={row}
          columns={columns}
          selectedRowId={selectedRowId}
          onSelectRow={onSelectRow}
          renderRowActions={renderRowActions}
          expandable={expandable}
        />
      ))}
    </>
  );
}

type DataTableHeadProps = Pick<DataTableProps, "columns" | "renderRowActions" | "expandable">;

function DataTableHead({ columns, renderRowActions, expandable }: DataTableHeadProps) {
  return (
    <thead>
      <tr className="border-b border-[var(--color-border-strong)] text-[length:var(--text-overline)] tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)]">
        {expandable && (
          <th className="w-[var(--space-6)]">
            <span className="sr-only">Expand</span>
          </th>
        )}
        {columns.map((column) => (
          <th key={column.key} className="px-[var(--space-3)] py-[var(--space-2)] text-left">
            {column.label}
          </th>
        ))}
        {renderRowActions && (
          <th className="px-[var(--space-3)] py-[var(--space-2)]">
            <span className="sr-only">Actions</span>
          </th>
        )}
      </tr>
    </thead>
  );
}

/** refit-mock.html `.table-card`/`.data-table` -- flat data grid card
 * (`components.md` "Glass vs flat": DataTable stays flat, no blur). Wraps
 * the table with an optional integrated `Pagination` footer. */
export function DataTable({
  columns,
  rows,
  loading,
  errorMessage,
  selectedRowId,
  onSelectRow,
  renderRowActions,
  expandable,
  pagination,
  className,
}: DataTableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        className
      )}
    >
      {/* table-fixed: table-layout:auto lets the table grow past its grid/flex
          track to fit unbroken content (e.g. long instance labels), overflowing
          the min-w-0 container and getting clipped -- reading as the aside
          panel overlapping the table (C4). Fixed layout keeps table width
          pinned to the container; content wraps in its cell instead. */}
      <table className="w-full table-fixed border-collapse text-[length:var(--text-body-sm)]">
        <DataTableHead columns={columns} renderRowActions={renderRowActions} expandable={expandable} />
        <tbody>
          <DataTableBody
            columns={columns}
            rows={rows}
            loading={loading}
            errorMessage={errorMessage}
            selectedRowId={selectedRowId}
            onSelectRow={onSelectRow}
            renderRowActions={renderRowActions}
            expandable={expandable}
          />
        </tbody>
      </table>
      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
