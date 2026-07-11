import type { Overlay, OverlayLegendEntry, OverlayLegendModel } from "../overlay-engine";
import type { RendererAdapter } from "../renderer-adapter";

export interface HeatmapMapping {
  /** key_properties path this dimension reads (e.g. "maturity"). */
  path: string;
  /** normalised free-text value -> colour token. */
  values: Record<string, string>;
}

export interface HeatmapConfig {
  /** --color-heat-none family token -- grey fallback for unmatched/absent values. */
  noneColour: string;
  heatmapMappings: Record<string, HeatmapMapping>;
}

/** PRD: free-text field, so lookup is case/whitespace-insensitive. */
function normalise(value: string): string {
  return value.trim().toLowerCase();
}

interface ColouringResult {
  colourByNodeId: Record<string, string>;
  unmatched: number;
  total: number;
}

function colourNodes(adapter: RendererAdapter, mapping: HeatmapMapping | undefined): ColouringResult {
  const colourByNodeId: Record<string, string> = {};
  let unmatched = 0;
  let total = 0;

  for (const element of adapter.listElements()) {
    if (element.data.source !== undefined) continue; // edge, not a node
    total += 1;
    const raw = element.data.key_properties?.[mapping?.path ?? ""];
    const colour = raw !== undefined && mapping ? mapping.values[normalise(raw)] : undefined;
    if (colour === undefined) {
      unmatched += 1;
      continue;
    }
    colourByNodeId[element.data.id] = colour;
  }

  return { colourByNodeId, unmatched, total };
}

function buildLegendEntries(mapping: HeatmapMapping | undefined): OverlayLegendEntry[] {
  if (!mapping) return [];
  return Object.entries(mapping.values).map(([value, colour]) => ({ label: value, colour }));
}

function buildNote(result: ColouringResult): string {
  const allUnmatched = result.total > 0 && result.unmatched === result.total;
  const base = `unmatched: ${result.unmatched}`;
  return allUnmatched ? `${base} -- no data for this dimension on any loaded node` : base;
}

/** FR-015/AC-1/AC-6: colours nodes by a prototype value->colour mapping for
 * one dimension (maturity/investment/strategy/lifecycle); unmatched or
 * absent values get the grey fallback, counted for the legend. */
export function createHeatmapOverlay(dimension: string, config: HeatmapConfig): Overlay {
  const mapping = config.heatmapMappings[dimension];
  let lastResult: ColouringResult = { colourByNodeId: {}, unmatched: 0, total: 0 };

  return {
    id: `heatmap:${dimension}`,
    exclusiveGroup: "colour",
    apply(adapter) {
      lastResult = colourNodes(adapter, mapping);
      adapter.applyNodeColours(lastResult.colourByNodeId, config.noneColour);
    },
    remove(adapter) {
      adapter.clearNodeColours();
    },
    legend(): OverlayLegendModel {
      return {
        title: `Heatmap — ${dimension}`,
        entries: buildLegendEntries(mapping),
        note: buildNote(lastResult),
      };
    },
  };
}
