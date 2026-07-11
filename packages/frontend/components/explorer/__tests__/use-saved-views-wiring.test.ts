import { describe, expect, it, vi } from "vitest";

import { applyDomainFocus, reconcileActiveOverlays } from "../use-saved-views-wiring";

describe("reconcileActiveOverlays", () => {
  it("toggles only the overlays whose active state disagrees with the target list", () => {
    const toggleOverlay = vi.fn();
    const toggles = [
      { id: "heatmap-a", label: "A", active: false, disabled: false },
      { id: "domain-colouring", label: "B", active: true, disabled: false },
    ];

    reconcileActiveOverlays(toggles, toggleOverlay, ["heatmap-a"]);

    expect(toggleOverlay).toHaveBeenCalledWith("heatmap-a"); // off -> should be on
    expect(toggleOverlay).toHaveBeenCalledWith("domain-colouring"); // on -> should be off
    expect(toggleOverlay).toHaveBeenCalledTimes(2);
  });

  it("does nothing when already in sync", () => {
    const toggleOverlay = vi.fn();
    const toggles = [{ id: "heatmap-a", label: "A", active: true, disabled: false }];

    reconcileActiveOverlays(toggles, toggleOverlay, ["heatmap-a"]);

    expect(toggleOverlay).not.toHaveBeenCalled();
  });
});

describe("applyDomainFocus", () => {
  it("focuses the given domain iri", () => {
    const focusDomain = vi.fn();
    const clearFocus = vi.fn();

    applyDomainFocus({ focusDomain, clearFocus } as never, "iri:domain-1");

    expect(focusDomain).toHaveBeenCalledWith("iri:domain-1");
    expect(clearFocus).not.toHaveBeenCalled();
  });

  it("clears focus for a null iri", () => {
    const focusDomain = vi.fn();
    const clearFocus = vi.fn();

    applyDomainFocus({ focusDomain, clearFocus } as never, null);

    expect(clearFocus).toHaveBeenCalled();
    expect(focusDomain).not.toHaveBeenCalled();
  });
});
