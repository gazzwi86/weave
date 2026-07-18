import type { KpiStripItem } from "@/components/molecules/KpiStrip";
import type { VersionEntry } from "@/lib/explorer/versions/types";

const PENDING = "Pending";

/** refit-mock.html `.kpi-strip`'s four tiles. CE-METRICS-1 (entity/relation
 * counts, SHACL violation counts) is an M2-only contract with no M1
 * producer -- entities/relations/violations render the honest "Pending"
 * state rather than the canvas's own capped/filtered render count (which
 * isn't the true aggregate) or a fabricated "0" (which would read as false
 * health for violations). "published" is real: the latest version's semver,
 * already available from `useVersionsPanel`. */
export function canvasKpiItems(versions: VersionEntry[]): KpiStripItem[] {
  const published = versions.find((version) => version.is_latest)?.semver ?? PENDING;
  return [
    { value: PENDING, label: "entities" },
    { value: PENDING, label: "relations" },
    { value: PENDING, label: "violations" },
    { value: published, label: "published" },
  ];
}
