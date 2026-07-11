import { KpiTile, type KpiTileProps } from "@/components/molecules/KpiTile";

/**
 * app/** import-boundary crossing (`weave/app-layer-boundary`) -- same
 * pass-through pattern as `EntityRefSlot`/`PageHeaderSlot`. AC-1: dashboard
 * headline stats render as `KpiTile` tiles, never plain `<p>` text rows,
 * without pages importing the molecule layer themselves.
 */
export function KpiTileSlot(props: KpiTileProps) {
  return <KpiTile {...props} />;
}
