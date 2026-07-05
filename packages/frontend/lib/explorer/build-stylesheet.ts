import type cytoscape from "cytoscape";

import type { NodeKind } from "./types";

/** AC-3: fallback colour for any node with an unrecognised or extension
 * `bpmo_kind`. */
export const UNKNOWN_KIND_COLOUR = "#9CA3AF";

function kindStyle(kind: NodeKind): cytoscape.StylesheetStyle {
  return {
    selector: `node[bpmo_kind="${kind.id}"]`,
    style: { "background-color": kind.colour },
  };
}

/** AC-3: single ellipse shape for every node in M1 (kind→shape mapping is
 * deferred, OQ-08) coloured by the CE-READ-1 palette, with a grey fallback
 * for anything the palette doesn't recognise. */
export function buildStylesheet(palette: NodeKind[]): cytoscape.StylesheetStyle[] {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "font-size": 12,
        shape: "ellipse",
        "background-color": UNKNOWN_KIND_COLOUR,
      },
    },
    ...palette.map(kindStyle),
    { selector: "edge", style: { label: "data(label)", "curve-style": "bezier" } },
  ];
}
