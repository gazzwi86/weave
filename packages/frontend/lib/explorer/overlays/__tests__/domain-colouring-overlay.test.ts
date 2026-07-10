import { describe, expect, it, vi } from "vitest";

import type { RendererAdapter } from "../../renderer-adapter";
import type { CytoscapeElement } from "../../types";
import { createDomainColouringOverlay, type DomainColouringConfig } from "../domain-colouring-overlay";

function fakeAdapter(elements: CytoscapeElement[]): RendererAdapter {
  return {
    listElements: vi.fn(() => elements),
    applyNodeColours: vi.fn(),
    clearNodeColours: vi.fn(),
  } as unknown as RendererAdapter;
}

const MEMBERSHIP_PREDICATE = "https://weave.example/ontology/bpmo#memberOfDomain";

const CONFIG: DomainColouringConfig = {
  membershipPredicate: MEMBERSHIP_PREDICATE,
  palette: ["var(--color-series-1)", "var(--color-series-2)"],
  noneColour: "var(--color-kind-fallback)",
};

function membershipEdge(nodeId: string, domainId: string) {
  return { data: { id: `${nodeId}|member|${domainId}`, source: nodeId, target: domainId, label: MEMBERSHIP_PREDICATE } };
}

describe("createDomainColouringOverlay", () => {
  // AC-3 core: colours nodes by domain membership, reading membership from
  // the already-loaded element edges (no additional fetch) per the brief's
  // "M1 graph load (element data)" implementation hint.
  it("colours nodes by their domain membership edge, read from already-loaded elements", () => {
    const adapter = fakeAdapter([
      { data: { id: "n1" } },
      { data: { id: "d1", label: "Sales" } },
      membershipEdge("n1", "d1"),
    ]);
    const overlay = createDomainColouringOverlay(CONFIG);

    overlay.apply(adapter);

    expect(adapter.applyNodeColours).toHaveBeenCalledWith({ n1: "var(--color-series-1)" }, "var(--color-kind-fallback)");
  });

  // AC-3: more domains than palette slots -- colours cycle, legend notes it.
  it("cycles the palette when domains exceed the palette length (AC-3)", () => {
    const adapter = fakeAdapter([
      { data: { id: "n1" } },
      { data: { id: "n2" } },
      { data: { id: "n3" } },
      { data: { id: "d1", label: "Sales" } },
      { data: { id: "d2", label: "Ops" } },
      { data: { id: "d3", label: "Legal" } },
      membershipEdge("n1", "d1"),
      membershipEdge("n2", "d2"),
      membershipEdge("n3", "d3"),
    ]);
    const overlay = createDomainColouringOverlay(CONFIG);

    overlay.apply(adapter);

    expect(adapter.applyNodeColours).toHaveBeenCalledWith(
      { n1: "var(--color-series-1)", n2: "var(--color-series-2)", n3: "var(--color-series-1)" },
      "var(--color-kind-fallback)"
    );
    expect(overlay.legend().note).toMatch(/cycl/i);
  });

  // Implementation hint: a node with multiple domain edges -- first-listed
  // wins, and the legend notes the tie-break happened.
  it("uses the first-listed domain when a node belongs to more than one, and notes it in the legend", () => {
    const adapter = fakeAdapter([
      { data: { id: "n1" } },
      { data: { id: "d1", label: "Sales" } },
      { data: { id: "d2", label: "Ops" } },
      membershipEdge("n1", "d1"),
      membershipEdge("n1", "d2"),
    ]);
    const overlay = createDomainColouringOverlay(CONFIG);

    overlay.apply(adapter);

    expect(adapter.applyNodeColours).toHaveBeenCalledWith({ n1: "var(--color-series-1)" }, "var(--color-kind-fallback)");
    expect(overlay.legend().note).toMatch(/multiple domain/i);
  });

  it("gives nodes with no domain membership the neutral fallback colour, not a series colour", () => {
    const adapter = fakeAdapter([{ data: { id: "n1" } }, { data: { id: "d1", label: "Sales" } }]);
    const overlay = createDomainColouringOverlay(CONFIG);

    overlay.apply(adapter);

    expect(adapter.applyNodeColours).toHaveBeenCalledWith({}, "var(--color-kind-fallback)");
  });

  // Edge case: zero membership edges loaded at all (distinct from the case
  // above, which still has a domain node in the graph). No domains, no
  // colours, no crash, no false-positive "cycled" note.
  it("handles zero domain-membership edges without crashing and shows an empty legend", () => {
    const adapter = fakeAdapter([{ data: { id: "n1" } }, { data: { id: "n2" } }]);
    const overlay = createDomainColouringOverlay(CONFIG);

    expect(() => overlay.apply(adapter)).not.toThrow();

    expect(adapter.applyNodeColours).toHaveBeenCalledWith({}, "var(--color-kind-fallback)");
    expect(overlay.legend()).toEqual({ title: "Domain colouring", entries: [], note: undefined });
  });

  it("restores prior colouring by clearing node colours on remove (AC-4)", () => {
    const adapter = fakeAdapter([]);
    const overlay = createDomainColouringOverlay(CONFIG);

    overlay.remove(adapter);

    expect(adapter.clearNodeColours).toHaveBeenCalledTimes(1);
  });

  it("is registered with the shared colour exclusiveGroup, exclusive with kind/heatmap colouring", () => {
    const overlay = createDomainColouringOverlay(CONFIG);
    expect(overlay.exclusiveGroup).toBe("colour");
    expect(overlay.id).toBe("domain-colouring");
  });

  it("legend shows domain label -> colour, falling back to the last IRI segment when unlabelled", () => {
    const adapter = fakeAdapter([
      { data: { id: "n1" } },
      { data: { id: "https://weave.example/domains/sales" } },
      membershipEdge("n1", "https://weave.example/domains/sales"),
    ]);
    const overlay = createDomainColouringOverlay(CONFIG);

    overlay.apply(adapter);

    expect(overlay.legend().entries).toEqual([{ label: "sales", colour: "var(--color-series-1)" }]);
  });
});
