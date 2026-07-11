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

/** TASK-005 AC-3: class applied to a node that was already on the canvas
 * when a neighbour expansion discovered it again -- highlighted, not
 * duplicated. Border colour is a design token, not an ad-hoc hex (Law 20). */
export const EXPLORER_HIGHLIGHT_CLASS = "explorer-highlight";

/** TASK-028 AC-3/AC-7: pinned impact/dependency trace -- a distinct amber
 * overlay (design-system: docs/standards/design/data-viz.md), deliberately
 * separate from the cyan spotlight class above, so "this is the impact
 * chain" never reads as "this is selected". */
export const EXPLORER_TRACE_CLASS = "explorer-trace";

const CSS_VAR_PATTERN = /^var\((--[\w-]+)\)$/;

/** Exported for the overlay colour seam (renderer-adapter-colour.ts) --
 * Cytoscape's live `.style()` calls hit <canvas> exactly like the base
 * stylesheet does, so a `var(--…)` colour an overlay hands in needs the
 * same single-value resolution before it reaches Cytoscape. */
export function resolveValue(value: unknown, resolve: (token: string) => string): unknown {
  if (typeof value !== "string") return value;
  const match = CSS_VAR_PATTERN.exec(value);
  return match ? resolve(match[1] as string) : value;
}

/** Cytoscape draws to <canvas> and never resolves CSS custom properties
 * itself -- reads a `var(--token)` design-token value straight from the DOM
 * cascade, the browser-only counterpart of the injected `resolve` above.
 * Shared by the base stylesheet (create-cytoscape.ts) and the overlay
 * colour seam (renderer-adapter.ts) -- the two places a colour reaches
 * Cytoscape's canvas. */
export function readCssToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || token;
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
    {
      selector: `node.${EXPLORER_HIGHLIGHT_CLASS}`,
      style: { "border-width": 3, "border-color": "var(--color-accent-primary)" },
    },
    {
      selector: `node.${EXPLORER_TRACE_CLASS}`,
      style: { "border-width": 3, "border-color": "var(--color-warn)" },
    },
    // TASK-022 AC-3/data-viz.md "Diff overlay": border colour + a
    // diffLabel data field (set by renderer-adapter-diff.ts, prefixed with
    // a +/-/~ glyph) so change type never reads as colour alone (WCAG
    // 1.4.1). Removed ghosts additionally dim to 0.35 opacity (tunable) --
    // still legible, distinct from a hidden node.
    { selector: "node.explorer-diff-added, edge.explorer-diff-added", style: { label: "data(diffLabel)" } },
    { selector: "node.explorer-diff-removed, edge.explorer-diff-removed", style: { label: "data(diffLabel)" } },
    { selector: "node.explorer-diff-modified, edge.explorer-diff-modified", style: { label: "data(diffLabel)" } },
    { selector: "node.explorer-diff-added", style: { "border-width": 3, "border-color": "var(--color-success)" } },
    {
      selector: "node.explorer-diff-removed",
      style: { "border-width": 3, "border-color": "var(--color-danger)", opacity: 0.35 },
    },
    { selector: "node.explorer-diff-modified", style: { "border-width": 3, "border-color": "var(--color-warn)" } },
    { selector: "edge.explorer-diff-added", style: { "line-color": "var(--color-success)", width: 3 } },
    { selector: "edge.explorer-diff-removed", style: { "line-color": "var(--color-danger)", opacity: 0.35 } },
    { selector: "edge.explorer-diff-modified", style: { "line-color": "var(--color-warn)", width: 3 } },
    // TASK-027 AC-1/design decision "Gap indicator = badge, not colour":
    // border + a gapBadgeLabel data field (glyph-prefixed, set by
    // renderer-adapter-badge.ts) so a gap never reads as colour alone
    // (WCAG 1.4.1) -- deliberately its own channel, so it coexists with an
    // active colour overlay (domain-colouring/heatmap).
    {
      selector: "node.explorer-gap-badge",
      style: { label: "data(gapBadgeLabel)", "border-width": 2, "border-color": "var(--color-warn)" },
    },
  ];
}
