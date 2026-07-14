import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import * as publicApi from "@/lib/explorer/public-api";

import { computeEffectiveReadonly, GraphCanvas, type GraphCanvasProps } from "../graph-canvas";

// AC-2 rule 3: "GraphCanvas throws a descriptive unsupported-mode error at
// mount" per ge-canvas-1.md -- React re-throws a render-phase error
// synchronously through `render()` when there's no error boundary, so this
// is a plain `toThrow`, not an async/effect assertion.
describe("GraphCanvas mode validation (unit)", () => {
  it("should throw descriptive unsupported-mode error for mode c4 at mount", () => {
    // React logs the caught render error to console.error; silence the expected noise.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const props = { source: "g1", mode: "c4", readonly: true } as unknown as GraphCanvasProps;
    expect(() => render(<GraphCanvas {...props} />)).toThrow(/GE-CANVAS-1 M2 supports mode:"force" only \(c4 is post-v1\)/);
    consoleError.mockRestore();
  });
});

describe("GraphCanvas effectiveReadonly (unit)", () => {
  it("should compute effectiveReadonly true when version set regardless of readonly prop", () => {
    expect(computeEffectiveReadonly(false, "urn:weave:version:1")).toBe(true);
    expect(computeEffectiveReadonly(true, "urn:weave:version:1")).toBe(true);
    expect(computeEffectiveReadonly(true, undefined)).toBe(true);
    expect(computeEffectiveReadonly(false, undefined)).toBe(false);
  });
});

describe("Explorer package public API (unit)", () => {
  it("should expose only GraphCanvas via package exports (import-surface test)", () => {
    expect(Object.keys(publicApi)).toEqual(["GraphCanvas"]);
  });
});
