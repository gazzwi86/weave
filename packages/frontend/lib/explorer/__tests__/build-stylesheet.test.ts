import { describe, expect, it } from "vitest";

import {
  buildStylesheet,
  EXPLORER_HIGHLIGHT_CLASS,
  EXPLORER_TRACE_CLASS,
  resolveStylesheetTokens,
  shapeForKind,
  UNKNOWN_KIND_COLOUR,
} from "../build-stylesheet";
import type { NodeKind } from "../types";

const PALETTE: NodeKind[] = [
  { id: "Process", label: "Process", colour: "#3B82F6" },
  { id: "DataAsset", label: "Data Asset", colour: "#10B981" },
];

describe("buildStylesheet", () => {
  it("maps each palette kind to its own node selector/colour", () => {
    const stylesheet = buildStylesheet(PALETTE);

    const processStyle = stylesheet.find((rule) => rule.selector === 'node[bpmo_kind="Process"]');
    const dataAssetStyle = stylesheet.find(
      (rule) => rule.selector === 'node[bpmo_kind="DataAsset"]'
    );

    expect(processStyle?.style).toMatchObject({ "background-color": "#3B82F6" });
    expect(dataAssetStyle?.style).toMatchObject({ "background-color": "#10B981" });
  });

  it("falls back unrecognised/extension kinds to grey via the base node selector", () => {
    const stylesheet = buildStylesheet(PALETTE);

    const baseNodeStyle = stylesheet.find((rule) => rule.selector === "node");

    expect(baseNodeStyle?.style).toMatchObject({ "background-color": UNKNOWN_KIND_COLOUR });
  });

  it("gives Process a distinct colour from the grey fallback", () => {
    const stylesheet = buildStylesheet(PALETTE);
    const processStyle = stylesheet.find((rule) => rule.selector === 'node[bpmo_kind="Process"]');

    const style = processStyle?.style as { "background-color"?: string } | undefined;
    expect(style?.["background-color"]).not.toBe(UNKNOWN_KIND_COLOUR);
  });
});

describe("resolveStylesheetTokens", () => {
  it("replaces a var(--token) style value with the resolver's concrete value", () => {
    const stylesheet = buildStylesheet([]);
    const resolved = resolveStylesheetTokens(stylesheet, () => "#6D7D94");

    const baseNodeStyle = resolved.find((rule) => rule.selector === "node");
    expect(baseNodeStyle?.style).toMatchObject({ "background-color": "#6D7D94" });
  });

  it("leaves non-token style values (e.g. CE-supplied hex, numeric text-margin-y) untouched", () => {
    const stylesheet = buildStylesheet([{ id: "Process", label: "Process", colour: "#3B82F6" }]);
    const resolved = resolveStylesheetTokens(stylesheet, () => "#6D7D94");

    const processStyle = resolved.find((rule) => rule.selector === 'node[bpmo_kind="Process"]');
    const baseNodeStyle = resolved.find((rule) => rule.selector === "node");
    expect(processStyle?.style).toMatchObject({ "background-color": "#3B82F6" });
    expect(baseNodeStyle?.style).toMatchObject({ "text-margin-y": 6 });
  });
});

// TASK-005 AC-3: nodes already present on the canvas are highlighted, not
// duplicated -- a stylesheet class (token-driven border colour), not an
// ad-hoc inline style (Law 20).
describe("buildStylesheet -- TASK-005 highlight class", () => {
  it(`includes a "node.${EXPLORER_HIGHLIGHT_CLASS}" rule with a token-driven border colour`, () => {
    const stylesheet = buildStylesheet([]);

    const highlightRule = stylesheet.find((rule) => rule.selector === `node.${EXPLORER_HIGHLIGHT_CLASS}`);

    expect(highlightRule?.style).toMatchObject({ "border-color": "var(--color-accent-primary)" });
  });
});

// TASK-028 AC-3/AC-7: the pinned-impact trace is a distinct amber overlay,
// deliberately separate from the cyan spotlight above, so "this is the
// impact chain" never reads as "this is selected" (docs/standards/design/data-viz.md).
describe("buildStylesheet -- TASK-028 trace class", () => {
  it(`includes a "node.${EXPLORER_TRACE_CLASS}" rule with the amber --color-warn token`, () => {
    const stylesheet = buildStylesheet([]);

    const traceRule = stylesheet.find((rule) => rule.selector === `node.${EXPLORER_TRACE_CLASS}`);

    expect(traceRule?.style).toMatchObject({ "border-color": "var(--color-warn)" });
  });
});

// refit round 1 item 1: per-kind shape (colour already ridden by kind.colour
// above) -- shape is a second, independent WCAG 1.4.1 channel so kind never
// reads as colour alone. Casing matches the proxy's `id.toLowerCase()` keys
// (app/api/proxy/node-kinds/route.ts), not the raw palette id.
describe("shapeForKind", () => {
  it.each([
    ["process", "diamond"],
    ["activity", "round-rectangle"],
    ["event", "ellipse"],
    ["actor", "ellipse"],
    ["policy", "round-tag"],
    ["businessdomain", "hexagon"],
    ["businesscapability", "round-rectangle"],
    ["system", "rectangle"],
    ["service", "triangle"],
    ["dataasset", "barrel"],
  ])("maps kind id %s to cytoscape shape %s", (kindId, shape) => {
    expect(shapeForKind(kindId).shape).toBe(shape);
  });

  it("is case-insensitive on the raw palette id (PascalCase from the IRI local name)", () => {
    expect(shapeForKind("Process").shape).toBe("diamond");
    expect(shapeForKind("DataAsset").shape).toBe("barrel");
  });

  it("gives Event a ring border to distinguish it from the plain Actor ellipse", () => {
    expect(shapeForKind("event")["border-width"]).toBeGreaterThan(0);
    expect(shapeForKind("actor")["border-width"]).toBeUndefined();
  });

  it("returns an empty style object (base ellipse fallback) for a kind the brief didn't map", () => {
    expect(shapeForKind("goal")).toEqual({});
    expect(shapeForKind("unknown-extension-kind")).toEqual({});
  });
});

describe("buildStylesheet -- per-kind shape wired into the palette rule", () => {
  it("merges the shape style into the same node[bpmo_kind=...] rule as the colour", () => {
    const stylesheet = buildStylesheet([{ id: "Process", label: "Process", colour: "#3B82F6" }]);
    const processStyle = stylesheet.find((rule) => rule.selector === 'node[bpmo_kind="Process"]');

    expect(processStyle?.style).toMatchObject({ "background-color": "#3B82F6", shape: "diamond" });
  });
});

// refit round 1 item 1: the readability fix -- name label BELOW the node in
// white body-sm text with a canvas-colour halo so it stays legible crossing
// an edge. Kind is carried by shape+colour+legend, not a second on-canvas
// caption (cytoscape nodes have exactly one `label`; see build-stylesheet.ts
// module docstring for the ADR-worthy reasoning, no ADR filed -- pure
// styling call, not an architectural one).
describe("buildStylesheet -- node label styling", () => {
  it("positions the label below the node in token-driven white text with a halo", () => {
    const stylesheet = buildStylesheet([]);
    const baseNodeStyle = stylesheet.find((rule) => rule.selector === "node");

    expect(baseNodeStyle?.style).toMatchObject({
      "text-valign": "bottom",
      "text-halign": "center",
      color: "var(--color-text-default)",
      "font-size": "var(--text-body-sm)",
      "font-weight": "var(--font-weight-semibold)",
      "text-outline-color": "var(--color-bg)",
    });
  });
});

describe("buildStylesheet -- edge styling", () => {
  it("gives edges a muted stroke and mono relationship-label halo", () => {
    const stylesheet = buildStylesheet([]);
    const edgeStyle = stylesheet.find((rule) => rule.selector === "edge");

    expect(edgeStyle?.style).toMatchObject({
      "line-color": "var(--color-border)",
      "target-arrow-color": "var(--color-border)",
      "curve-style": "bezier",
      "font-family": "var(--font-mono)",
      "text-background-color": "var(--color-bg)",
    });
  });
});
