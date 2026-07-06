import type cytoscape from "cytoscape";

import type { NodeKind } from "./types";

/** AC-3: fallback colour for any node with an unrecognised or extension
 * `bpmo_kind` -- design token, not an ad-hoc hex (docs/standards/design/color.md). */
export const UNKNOWN_KIND_COLOUR = "var(--color-kind-fallback)";

function kindStyle(kind: NodeKind): cytoscape.StylesheetStyle {
  return {
    selector: `node[bpmo_kind="${kind.id}"]`,
    style: { "background-color": kind.colour },
  };
}

const CSS_VAR_PATTERN = /^var\((--[\w-]+)\)$/;

function resolveValue(value: unknown, resolve: (token: string) => string): unknown {
  if (typeof value !== "string") return value;
  const match = CSS_VAR_PATTERN.exec(value);
  return match ? resolve(match[1] as string) : value;
}

/** Cytoscape's stylesheet engine draws to <canvas> and never resolves CSS
 * custom properties -- any `var(--token)` value (e.g. the design-token grey
 * fallback) must be resolved to a concrete value before reaching the real
 * renderer. `resolve` is injected so this stays testable without a real DOM
 * stylesheet (ADR-001 seam); the browser boundary supplies the real
 * `getComputedStyle` reader (create-cytoscape.ts). */
export function resolveStylesheetTokens(
  stylesheet: cytoscape.StylesheetStyle[],
  resolve: (token: string) => string,
): cytoscape.StylesheetStyle[] {
  return stylesheet.map((rule) => ({
    ...rule,
    style: Object.fromEntries(
      Object.entries(rule.style).map(([key, value]) => [key, resolveValue(value, resolve)]),
    ) as typeof rule.style,
  }));
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
