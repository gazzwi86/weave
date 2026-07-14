import { describe, expect, it } from "vitest";

import { canEditCanvas } from "../can-edit-canvas";

// TASK-023 AC-7 (UX layer only -- server-side rejection is the real
// boundary, ADR-019/CE-WRITE-1). TASK-022 owns flipping isDraftCanvas to
// false when a published version is pinned; until it lands this defaults
// true (M1 canvas is always draft today).
// TASK-023 AC-7 canonical role slugs -- ADR-020 (weave-platform.md "Canonical
// human roles") names business_analyst_sme (BA) and enterprise_architect
// (ontologist) as the real in-tenant role strings rbac.py's ROLE_RANK and
// workspace_members.role issue; "BA"/"ontologist" never appear on the wire.
describe("canEditCanvas", () => {
  it.each(["business_analyst_sme", "enterprise_architect"])("allows role %s on the draft canvas", (role) => {
    expect(canEditCanvas({ role, isDraftCanvas: true })).toBe(true);
  });

  it("blocks the viewer role", () => {
    expect(canEditCanvas({ role: "viewer", isDraftCanvas: true })).toBe(false);
  });

  it("blocks an unrecognised or missing role", () => {
    expect(canEditCanvas({ role: null, isDraftCanvas: true })).toBe(false);
  });

  it("blocks editing on a pinned published version even for an editor role", () => {
    expect(canEditCanvas({ role: "enterprise_architect", isDraftCanvas: false })).toBe(false);
  });
});
