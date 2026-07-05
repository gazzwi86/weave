import { describe, expect, it } from "vitest";

import { buildStylesheet, UNKNOWN_KIND_COLOUR } from "../build-stylesheet";
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
