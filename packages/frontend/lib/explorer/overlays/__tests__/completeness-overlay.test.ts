import { describe, expect, it, vi } from "vitest";

import type { RendererAdapter } from "../../renderer-adapter";
import { createCompletenessOverlay } from "../completeness-overlay";
import type { CoverageGapRow } from "../../fetch-coverage-gaps";

function fakeAdapter(nodeIds: string[]): RendererAdapter {
  const known = new Set(nodeIds);
  return {
    getNodeData: vi.fn((id: string) => (known.has(id) ? { label: id, bpmoKind: "Process" } : undefined)),
    setBadges: vi.fn(),
    clearBadges: vi.fn(),
  } as unknown as RendererAdapter;
}

const ROWS: CoverageGapRow[] = [
  { entityIri: "entity-1", missingLink: "https://weave.example/ontology/bpmo#performedBy" },
  { entityIri: "entity-1", missingLink: "https://weave.example/ontology/bpmo#governedBy" },
  { entityIri: "entity-2", missingLink: "https://weave.example/ontology/bpmo#performedBy" },
  { entityIri: "off-canvas-entity", missingLink: "https://weave.example/ontology/bpmo#performedBy" },
];

describe("createCompletenessOverlay", () => {
  // AC-1: badges only returned entity_iris, leaves others neutral.
  it("badges only on-canvas returned entity_irs with their gap count", () => {
    const adapter = fakeAdapter(["entity-1", "entity-2"]);
    const overlay = createCompletenessOverlay(ROWS, []);

    overlay.apply(adapter);

    expect(adapter.setBadges).toHaveBeenCalledWith({ "entity-1": 2, "entity-2": 1 });
  });

  // AC-6
  it("counts off-canvas gap rows in the legend note instead of dropping them", () => {
    const adapter = fakeAdapter(["entity-1", "entity-2"]);
    const overlay = createCompletenessOverlay(ROWS, []);

    overlay.apply(adapter);
    const legend = overlay.legend();

    expect(legend.note).toContain("1");
    expect(legend.note).toMatch(/not shown/i);
  });

  it("removes badges on deactivation", () => {
    const adapter = fakeAdapter(["entity-1"]);
    const overlay = createCompletenessOverlay(ROWS, []);

    overlay.remove(adapter);

    expect(adapter.clearBadges).toHaveBeenCalled();
  });

  it("has no exclusiveGroup -- coexists with an active colour overlay (AC-7)", () => {
    const overlay = createCompletenessOverlay([], []);
    expect(overlay.exclusiveGroup).toBeUndefined();
  });

  it("summarises entity count with no gaps -- legend shows a plain count when there are gaps", () => {
    const adapter = fakeAdapter(["entity-1", "entity-2"]);
    const overlay = createCompletenessOverlay(ROWS, []);

    overlay.apply(adapter);
    const legend = overlay.legend();

    expect(legend.title).toBe("Completeness");
    expect(legend.note).toContain("2 entities with gaps");
  });
});
