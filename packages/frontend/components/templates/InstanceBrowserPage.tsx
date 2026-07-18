import type { ReactNode } from "react";

import { KindChip, type BpmoKind } from "@/components/molecules/KindChip";
import { DataTable, DataTableNameCell, type DataTableColumn } from "@/components/organisms/DataTable";
import { InspectorPanel, type InspectorPanelProps } from "@/components/organisms/InspectorPanel";
import { FilterBar, type FilterChip } from "@/components/ui/filter-bar";
import type { PaginationProps } from "@/components/ui/pagination";

export interface InstanceRowView {
  iri: string;
  label: string;
  kindSlug: BpmoKind;
  kindLabel: string;
}

export interface InstancesBrowsePageProps {
  rows: InstanceRowView[];
  loading?: boolean;
  errorMessage?: string;
  selectedRowId?: string;
  onSelectRow: (id: string) => void;
  pagination: PaginationProps;
  kindChips: FilterChip[];
  activeChipIds: readonly string[];
  onToggleChip: (id: string) => void;
  search: { value: string; onChange: (value: string) => void; label: string; placeholder?: string };
  filterTrailing?: ReactNode;
  /** `null` when no row is selected -- renders no aside panel. */
  inspector: InspectorPanelProps | null;
  /** The selected row's kind -- rendered as a swatch above the inspector
   * (refit-mock.html `.ins-head`'s colour swatch, approximated with the
   * existing `KindChip` atom rather than a new bespoke swatch component). */
  inspectorKind: { slug: BpmoKind; label: string } | null;
  /** Opaque slot for an app-layer widget (e.g. the instances page's chat
   * aside) -- this template never imports or fetches it. */
  asideExtra?: ReactNode;
}

const COLUMNS: DataTableColumn[] = [
  { key: "name", label: "Name" },
  { key: "kind", label: "Kind" },
  { key: "status", label: "Status" },
  { key: "updated", label: "Updated" },
];

// ponytail: Status/Updated have no backing data on `InstanceRow` or the
// backend's `InstanceSummary` (iri/kind/label only) -- rendered as an
// explicit "not available" dash rather than fabricated, same precedent as
// the inspector's `history: "unavailable"` (TASK-031-blocker.md).
function UnavailableCell() {
  return <span className="text-[var(--color-text-subtle)]">—</span>;
}

function buildRows(rows: InstanceRowView[]) {
  return rows.map((row) => ({
    id: row.iri,
    cells: {
      name: <DataTableNameCell label={row.label} id={row.iri} />,
      kind: <KindChip kind={row.kindSlug} label={row.kindLabel} />,
      status: <UnavailableCell />,
      updated: <UnavailableCell />,
    },
  }));
}

/** refit-mock.html `#sub-instances` -- FilterBar + DataTable (name/kind/
 * status/updated) with an integrated Pagination footer, plus an
 * InspectorPanel aside. Fully data-bound (Law 20 / dumb-component
 * boundary): no fetch, every value is caller-supplied -- app/** builds row
 * view-models and passes them in rather than importing `KindChip`/
 * `DataTable`/`InspectorPanel` directly (`app-layer-boundary` rule).
 */
export function InstancesBrowsePage({
  rows,
  loading,
  errorMessage,
  selectedRowId,
  onSelectRow,
  pagination,
  kindChips,
  activeChipIds,
  onToggleChip,
  search,
  filterTrailing,
  inspector,
  inspectorKind,
  asideExtra,
}: InstancesBrowsePageProps) {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <FilterBar chips={kindChips} activeIds={activeChipIds} onToggle={onToggleChip} search={search} trailing={filterTrailing} />
      <div className="grid grid-cols-[1fr_320px] gap-[var(--space-4)]">
        <DataTable
          columns={COLUMNS}
          rows={buildRows(rows)}
          loading={loading}
          errorMessage={errorMessage}
          selectedRowId={selectedRowId}
          onSelectRow={onSelectRow}
          pagination={pagination}
        />
        <div className="flex flex-col gap-[var(--space-4)]">
          {inspector && (
            <div className="flex flex-col gap-[var(--space-2)]">
              {inspectorKind && <KindChip kind={inspectorKind.slug} label={inspectorKind.label} />}
              <InspectorPanel {...inspector} />
            </div>
          )}
          {asideExtra}
        </div>
      </div>
    </div>
  );
}
