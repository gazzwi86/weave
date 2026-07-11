import { describe, expect, it } from "vitest";

import { canEditCanvas } from "../can-edit-canvas";

// TASK-023 AC-7 (UX layer only -- server-side rejection is the real
// boundary, ADR-019/CE-WRITE-1). TASK-022 owns flipping isDraftCanvas to
// false when a published version is pinned; until it lands this defaults
// true (M1 canvas is always draft today).
describe("canEditCanvas", () => {
  it.each(["BA", "ontologist"])("allows role %s on the draft canvas", (role) => {
    expect(canEditCanvas({ role, isDraftCanvas: true })).toBe(true);
  });

  it("blocks the viewer role", () => {
    expect(canEditCanvas({ role: "viewer", isDraftCanvas: true })).toBe(false);
  });

  it("blocks an unrecognised or missing role", () => {
    expect(canEditCanvas({ role: null, isDraftCanvas: true })).toBe(false);
  });

  it("blocks editing on a pinned published version even for an editor role", () => {
    expect(canEditCanvas({ role: "ontologist", isDraftCanvas: false })).toBe(false);
  });
});
