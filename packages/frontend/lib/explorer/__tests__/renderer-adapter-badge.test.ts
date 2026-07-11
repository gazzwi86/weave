import { describe, expect, it, vi } from "vitest";

import { clearBadgesOn, setBadgesOn } from "../renderer-adapter-badge";
import type { AdaptableCy } from "../renderer-adapter";

function makeCy() {
  const elements = new Map<string, { data: Record<string, unknown>; classes: Set<string> }>();

  function makeElement(id: string) {
    if (!elements.has(id)) elements.set(id, { data: {}, classes: new Set() });
    const record = elements.get(id)!;
    return {
      length: 1,
      addClass: vi.fn((cls: string) => record.classes.add(cls)),
      removeClass: vi.fn((cls: string) => record.classes.delete(cls)),
      data: vi.fn((...args: [string] | [string, unknown]) => {
        const [key] = args;
        if (args.length === 1) return record.data[key];
        record.data[key] = args[1];
        return undefined;
      }),
    };
  }

  const missingElement = { length: 0, addClass: vi.fn(), removeClass: vi.fn(), data: vi.fn() };

  const cy = {
    batch: vi.fn((fn: () => void) => fn()),
    getElementById: vi.fn((id: string) => (id === "missing" ? missingElement : makeElement(id))),
    elements: vi.fn(() => {
      const all = [...elements.keys()].map((id) => makeElement(id));
      return {
        removeClass: (cls: string) => all.forEach((el) => el.removeClass(cls)),
        data: (key: string, value: unknown) => all.forEach((el) => el.data(key, value)),
      };
    }),
  } as unknown as AdaptableCy;

  return { cy, elements };
}

describe("setBadgesOn / clearBadgesOn", () => {
  it("sets the gap-badge class and a text-equivalent label with the count (AC-1, WCAG 1.4.1)", () => {
    const { cy, elements } = makeCy();

    setBadgesOn(cy, { "node-1": 3 });

    const record = elements.get("node-1")!;
    expect(record.classes.has("explorer-gap-badge")).toBe(true);
    expect(record.data.gapBadgeLabel).toContain("3");
  });

  it("is a no-op for a node id not on the canvas (AC-6: off-canvas rows counted, never applied)", () => {
    const { cy } = makeCy();

    expect(() => setBadgesOn(cy, { missing: 2 })).not.toThrow();
  });

  it("applies every id in one batched pass", () => {
    const { cy } = makeCy();

    setBadgesOn(cy, { "node-1": 1, "node-2": 2 });

    expect(cy.batch).toHaveBeenCalledTimes(1);
  });

  it("clears the badge class and label from every element", () => {
    const { cy, elements } = makeCy();
    setBadgesOn(cy, { "node-1": 3 });

    clearBadgesOn(cy);

    const record = elements.get("node-1")!;
    expect(record.classes.has("explorer-gap-badge")).toBe(false);
    expect(record.data.gapBadgeLabel).toBeUndefined();
  });
});
