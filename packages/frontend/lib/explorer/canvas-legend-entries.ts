import type { CanvasLegendEntry } from "@/components/molecules/CanvasLegend";
import type { BpmoKind } from "@/components/molecules/KindChip";
import type { OverlaySection } from "@/components/molecules/OverlayKey";

import { stripVarWrapper } from "./css-var";
import type { OverlayLegendModel } from "./overlay-engine";
import type { NodeKind } from "./types";

// KindChip's BpmoKind union, mirrored here as a runtime guard -- CE-READ-1's
// kind catalogue can grow past these 14, and an id KindChip has no
// glyph/colour for must be dropped, not rendered blank.
const KNOWN_KINDS = new Set<string>([
  "activity",
  "actor",
  "businesscapability",
  "businessdomain",
  "class",
  "concept",
  "dataasset",
  "event",
  "field",
  "goal",
  "policy",
  "process",
  "service",
  "system",
]);

/** CE-READ-1's palette returns each kind `id` in its raw PascalCase IRI
 * segment (e.g. `"Process"`), while `BpmoKind`/`KindChip` key off the
 * lowercase form -- this is the single place that bridges the two. */
export function paletteToLegendEntries(palette: NodeKind[]): CanvasLegendEntry[] {
  return palette
    .map((kind) => ({ kind: kind.id.toLowerCase(), label: kind.label }))
    .filter((entry): entry is CanvasLegendEntry => KNOWN_KINDS.has(entry.kind))
    .map((entry) => ({ ...entry, kind: entry.kind as BpmoKind }));
}

/** The active colour-overlay's legend (if any) as `OverlayKey`'s section
 * list -- `OverlayKey` renders nothing for an empty array, matching the
 * mock's `#overlay-key` staying hidden while no overlay is active. Carries
 * `OverlayLegendModel.note` (unmatched-count/palette-cycle text) through
 * to the section so it can render under the swatch rows. */
export function overlayLegendToSections(legend: OverlayLegendModel | null): OverlaySection[] {
  if (!legend) return [];
  return [
    {
      id: "overlay",
      label: legend.title,
      rows: legend.entries.map((entry) => ({ colorVar: stripVarWrapper(entry.colour), label: entry.label })),
      note: legend.note,
    },
  ];
}

const FALLBACK_KIND_COLOUR_VAR = "--color-kind-fallback";

/** Same lowercase-id + known-kind gate as `paletteToLegendEntries` above,
 * for a caller that needs the bare `--color-kind-*` token outside a
 * `CanvasLegendEntry` -- the minimap's per-node dot colour, so a dot always
 * matches its kind's legend swatch. CE-READ-1's `bpmo_kind` (not the
 * palette's own `colour`, which travels as a raw hex, not a design token). */
export function nodeKindColorVar(bpmoKind: string): string {
  const kind = (bpmoKind ?? "").toLowerCase();
  return KNOWN_KINDS.has(kind) ? `--color-kind-${kind}` : FALLBACK_KIND_COLOUR_VAR;
}
