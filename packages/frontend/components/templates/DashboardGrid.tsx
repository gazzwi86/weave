import { KpiTile, type KpiTileProps } from "@/components/molecules/KpiTile";

export interface DashboardGridProps {
  tiles: KpiTileProps[];
}

/** KPI dashboard shell -- a responsive grid of `KpiTile`s. Data-only props,
 * one entry per tile, no fetch or business logic here. */
export function DashboardGrid({ tiles }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <KpiTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}
