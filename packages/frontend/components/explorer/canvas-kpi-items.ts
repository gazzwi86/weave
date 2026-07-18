import type { KpiStripItem } from "@/components/molecules/KpiStrip";
import type { CytoscapeElement } from "@/lib/explorer/types";
import type { VersionEntry } from "@/lib/explorer/versions/types";

const PENDING = "Pending";

/** refit-mock.html `.kpi-strip`'s four tiles. CE-METRICS-1 (the true
 * entity/relation/violation aggregate) is an M2-only contract with no M1
 * producer. entities/relations fall back to the canvas's own loaded-element
 * count when available -- capped/filtered/expansion-dependent
 * (MAX_VISIBLE_NODES), so not the true aggregate, but real enough to beat
 * "Pending". violations has no client-side SHACL source either way, so it
 * always stays "Pending" -- a fabricated "0" would read as false health.
 * "published" is real: the latest version's semver, already available from
 * `useVersionsPanel`. */
export function canvasKpiItems(versions: VersionEntry[], elements: CytoscapeElement[] | null): KpiStripItem[] {
  const published = versions.find((version) => version.is_latest)?.semver ?? PENDING;
  const relations = elements?.filter((element) => element.data.source !== undefined).length;
  const entities = elements ? elements.length - (relations ?? 0) : undefined;
  return [
    { value: entities !== undefined ? String(entities) : PENDING, label: "entities" },
    { value: relations !== undefined ? String(relations) : PENDING, label: "relations" },
    { value: PENDING, label: "violations" },
    { value: published, label: "published" },
  ];
}
