import type { ReactNode } from "react";

import { KindChip, type BpmoKind } from "@/components/molecules/KindChip";
import { PageHeader } from "@/components/molecules/PageHeader";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/organisms/DataTable";
import { InspectorPanel, type InspectorPanelProps } from "@/components/organisms/InspectorPanel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type { DataTableColumn, DataTableRow };

export interface KindFilterOption {
  iri: string;
  label: string;
  slug: BpmoKind;
}

/** Kind-chip cell for the "kind" column (AC-1) -- app layer builds rows with
 * this instead of importing `KindChip` directly (app-layer-boundary rule).
 */
export function KindCell({ kind }: { kind: BpmoKind }) {
  return <KindChip kind={kind} label="" />;
}

export interface InstanceBrowserPageProps {
  kinds: KindFilterOption[];
  activeKindFilter: string | null;
  onToggleKind: (iri: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  loading?: boolean;
  errorMessage?: string;
  selectedRowId?: string;
  onSelectRow?: (id: string) => void;
  addAction?: ReactNode;
  inspector?: InspectorPanelProps | null;
  className?: string;
}

function KindFilterChip({ kind, active, onToggle }: { kind: KindFilterOption; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "rounded-[var(--radius-sm)] outline-offset-2",
        active && "ring-2 ring-[var(--color-accent-primary)]"
      )}
    >
      <KindChip kind={kind.slug} label={kind.label} />
    </button>
  );
}

function KindFilterRow({ kinds, activeKindFilter, onToggleKind }: Pick<InstanceBrowserPageProps, "kinds" | "activeKindFilter" | "onToggleKind">) {
  return (
    <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-[var(--space-2)]">
      {kinds.map((kind) => (
        <KindFilterChip
          key={kind.iri}
          kind={kind}
          active={activeKindFilter === kind.iri}
          onToggle={() => onToggleKind(kind.iri)}
        />
      ))}
    </div>
  );
}

/** Browse/search surface (TASK-031 AC-1/AC-2/AC-3): kind-chip filter row,
 * search box, dense table, right inspector -- data-only props, no fetch or
 * routing here (the app layer, `app/ce/instances/page.tsx`, binds data). */
export function InstanceBrowserPage({
  kinds,
  activeKindFilter,
  onToggleKind,
  searchTerm,
  onSearchChange,
  columns,
  rows,
  loading,
  errorMessage,
  selectedRowId,
  onSelectRow,
  addAction,
  inspector,
  className,
}: InstanceBrowserPageProps) {
  return (
    <div className={cn("flex flex-col gap-[var(--space-4)]", className)}>
      <PageHeader title="Instances / Data" actions={addAction} />
      <KindFilterRow kinds={kinds} activeKindFilter={activeKindFilter} onToggleKind={onToggleKind} />
      <Input
        aria-label="Search instances"
        placeholder="Search by name..."
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className="flex gap-[var(--space-4)]">
        <DataTable
          className="flex-1"
          columns={columns}
          rows={rows}
          loading={loading}
          errorMessage={errorMessage}
          selectedRowId={selectedRowId}
          onSelectRow={onSelectRow}
        />
        {inspector && <InspectorPanel {...inspector} />}
      </div>
    </div>
  );
}
