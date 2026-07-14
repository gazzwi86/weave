import { describe, expect, it } from "vitest";
import { auditAnchors, extractDataTourIds } from "../onboarding/checks/audit";
import type { Anchor } from "../onboarding/anchors";

const registry: Record<string, Anchor> = {
  "ce.overview": { engine: "constitution", area: "constitution", phase: "m1", shipped: true, planted_by: "TASK-007" },
  "ce.query": { engine: "constitution", area: "constitution", phase: "m1", shipped: false, planted_by: "TASK-007" },
};

describe("extractDataTourIds", () => {
  it("pulls data-tour-id values out of JSX source", () => {
    const source = `<div data-tour-id="ce.overview" /><span data-tour-id='ce.query'></span>`;
    expect(extractDataTourIds(source)).toEqual(["ce.overview", "ce.query"]);
  });
});

describe("auditAnchors (AC-003-05, ADR-008)", () => {
  it("passes when every shipped anchor's attribute is present and every attribute is registered", () => {
    const result = auditAnchors(registry, new Set(["ce.overview"]));
    expect(result).toEqual({ ok: true, unregistered: [], missingShipped: [], plantedNotShipped: [] });
  });

  it("fails on an unregistered attribute fixture", () => {
    const result = auditAnchors(registry, new Set(["ce.overview", "not-a-real-anchor"]));
    expect(result.ok).toBe(false);
    expect(result.unregistered).toEqual(["not-a-real-anchor"]);
  });

  it("fails on a missing-anchor fixture -- shipped:true with no attribute in code", () => {
    const result = auditAnchors(registry, new Set());
    expect(result.ok).toBe(false);
    expect(result.missingShipped).toEqual(["ce.overview"]);
  });

  it("does not flag a shipped:false anchor as missing (nothing planted yet)", () => {
    const result = auditAnchors(registry, new Set(["ce.overview"]));
    expect(result.missingShipped).not.toContain("ce.query");
  });

  it("fails on an attribute-without-shipped fixture -- registered but still shipped:false (AC-001-03b)", () => {
    const result = auditAnchors(registry, new Set(["ce.query"]));
    expect(result.ok).toBe(false);
    expect(result.plantedNotShipped).toEqual(["ce.query"]);
  });

  it("does not flag a shipped:true anchor with its attribute present as plantedNotShipped", () => {
    const result = auditAnchors(registry, new Set(["ce.overview"]));
    expect(result.plantedNotShipped).not.toContain("ce.overview");
  });
});
