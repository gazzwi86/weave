import { describe, expect, it, vi } from "vitest";

import { OverlayEngine } from "../../overlay-engine";
import type { ListedNode, RendererAdapter } from "../../renderer-adapter";
import { createDomainColouringOverlay } from "../domain-colouring-overlay";
import { createPinnedImpactOverlay, type PinnedTraceResult } from "../pinned-impact-overlay";

function fakeAdapter(overrides: Partial<RendererAdapter> = {}): RendererAdapter {
  return {
    listNodes: vi.fn(() => []),
    setTraceHighlight: vi.fn(),
    clearTraceHighlight: vi.fn(),
    isHidden: vi.fn(() => false),
    onElementRemoved: vi.fn(() => vi.fn()),
    applyNodeColours: vi.fn(),
    clearNodeColours: vi.fn(),
    ...overrides,
  } as unknown as RendererAdapter;
}

function listedNode(id: string): ListedNode {
  return { id, label: id, bpmoKind: "Process" };
}

const TRACE: PinnedTraceResult = { sourceIri: "urn:Policy1", memberIris: ["urn:Process1", "urn:DataAsset1"] };

describe("createPinnedImpactOverlay (TASK-028 AC-3/AC-4/AC-5/AC-7)", () => {
  it("id is namespaced by the trace's source node, and never joins the colour exclusiveGroup (AC-7)", () => {
    const overlay = createPinnedImpactOverlay(TRACE, new OverlayEngine(), vi.fn());
    expect(overlay.id).toBe("pinned-impact:urn:Policy1");
    expect(overlay.exclusiveGroup).toBeUndefined();
  });

  // AC-3: only member iris that are actually loaded on canvas get highlighted --
  // a trace member outside the current viewport/layer set can't be styled.
  it("applies the trace highlight to loaded member ids only", () => {
    const adapter = fakeAdapter({ listNodes: vi.fn(() => [listedNode("urn:Process1")]) });
    const overlay = createPinnedImpactOverlay(TRACE, new OverlayEngine(), vi.fn());

    overlay.apply(adapter);

    expect(adapter.setTraceHighlight).toHaveBeenCalledWith(["urn:Process1"]);
  });

  it("remove() clears the trace highlight and unsubscribes the removal listener", () => {
    const adapter = fakeAdapter();
    const unsubscribe = vi.fn();
    adapter.onElementRemoved = vi.fn(() => unsubscribe);
    const overlay = createPinnedImpactOverlay(TRACE, new OverlayEngine(), vi.fn());

    overlay.apply(adapter);
    overlay.remove(adapter);

    expect(adapter.clearTraceHighlight).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  // AC-4: source node deleted (any removal path -- TASK-024 or otherwise)
  // auto-deactivates the pin on its own engine and raises a notice.
  it("auto-clears via the engine and notifies when the trace's source node is removed", () => {
    const adapter = fakeAdapter();
    let removedHandler: ((id: string) => void) | undefined;
    adapter.onElementRemoved = vi.fn((handler) => {
      removedHandler = handler;
      return vi.fn();
    });
    const engine = new OverlayEngine();
    const notify = vi.fn();
    const overlay = createPinnedImpactOverlay(TRACE, engine, notify);

    engine.activate(overlay, adapter);
    removedHandler?.("urn:Process1"); // not the source -- no-op
    expect(engine.isActive(overlay.id)).toBe(true);

    removedHandler?.("urn:Policy1"); // the trace's source
    expect(engine.isActive(overlay.id)).toBe(false);
    expect(notify).toHaveBeenCalledWith("Pinned trace source deleted");
  });

  // AC-5: legend's hidden-by-filters count is a live read (via the adapter
  // captured at apply-time), not a snapshot -- so it reflects a filter
  // change that happens after the trace was pinned, no re-apply needed.
  it("legend reports a live hidden-by-filters count", () => {
    const isHidden = vi.fn((iri: string) => iri === "urn:DataAsset1");
    const adapter = fakeAdapter({ isHidden });
    const overlay = createPinnedImpactOverlay(TRACE, new OverlayEngine(), vi.fn());

    overlay.apply(adapter);

    expect(overlay.legend().note).toBe("1 of 2 hidden by filters");

    isHidden.mockImplementation(() => false);
    expect(overlay.legend().note).toBeUndefined();
  });

  // AC-7: the pin's highlight channel is independent of the "colour"
  // exclusiveGroup -- activating a colour overlay never deactivates the pin,
  // and vice versa, so both stay visible on canvas together.
  it("coexists with an active colour overlay on the same engine (AC-7)", () => {
    const adapter = fakeAdapter();
    const engine = new OverlayEngine();
    const colourOverlay = createDomainColouringOverlay({
      membershipPredicate: "https://weave.example/ontology/bpmo#memberOfDomain",
      palette: ["var(--color-series-1)"],
      noneColour: "var(--color-kind-fallback)",
    });
    const pinOverlay = createPinnedImpactOverlay(TRACE, engine, vi.fn());

    engine.activate(colourOverlay, adapter);
    engine.activate(pinOverlay, adapter);

    expect(engine.isActive(colourOverlay.id)).toBe(true);
    expect(engine.isActive(pinOverlay.id)).toBe(true);
  });
});
