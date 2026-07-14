import { describe, expect, it } from "vitest";

import * as publicApi from "../public-api";

// AC-1: `GraphCanvas` is the ONLY runtime export off the package public API
// -- no other Explorer internal (CanvasCore, ExplorerInteractions, hooks)
// is importable through this module. `GraphCanvasProps` is a type-only
// export, erased at compile time, so it doesn't show up in the runtime key
// set below (asserted separately by graph-canvas.test.tsx's prop-shape use).
describe("Explorer package public API (GE-CANVAS-1 AC-1)", () => {
  it("exposes only GraphCanvas via package exports", () => {
    expect(Object.keys(publicApi)).toEqual(["GraphCanvas"]);
  });

  it("exports a function component", () => {
    expect(typeof publicApi.GraphCanvas).toBe("function");
  });
});
