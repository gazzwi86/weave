import { describe, expect, it } from "vitest";

import {
  buildStylesheet,
  EXPLORER_HIGHLIGHT_CLASS,
  EXPLORER_TRACE_CLASS,
  resolveStylesheetTokens,
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

  it("leaves non-token style values (e.g. CE-supplied hex, numeric font-size) untouched", () => {
    const stylesheet = buildStylesheet([{ id: "Process", label: "Process", colour: "#3B82F6" }]);
    const resolved = resolveStylesheetTokens(stylesheet, () => "#6D7D94");

    const processStyle = resolved.find((rule) => rule.selector === 'node[bpmo_kind="Process"]');
    const baseNodeStyle = resolved.find((rule) => rule.selector === "node");
    expect(processStyle?.style).toMatchObject({ "background-color": "#3B82F6" });
    expect(baseNodeStyle?.style).toMatchObject({ "font-size": 12 });
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
