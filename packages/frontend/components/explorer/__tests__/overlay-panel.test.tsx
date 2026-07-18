import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OverlayToggle } from "../use-overlay-controls";

import { OverlayPanel } from "../overlay-panel";

const TOGGLES: OverlayToggle[] = [
  { id: "heatmap:maturity", label: "Heatmap: Maturity", active: false, disabled: false },
  { id: "domain-colouring", label: "Domain colouring", active: false, disabled: false },
];

describe("OverlayPanel", () => {
  it("renders a switch per overlay toggle, reflecting active state (AC-1/AC-3)", () => {
    const toggles: OverlayToggle[] = [{ ...TOGGLES[0]!, active: true }, TOGGLES[1]!];
    render(<OverlayPanel toggles={toggles} onToggleOverlay={vi.fn()} />);

    expect(screen.getByRole("switch", { name: "Heatmap: Maturity" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Domain colouring" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onToggleOverlay with the overlay id when its switch is clicked (AC-1)", () => {
    const onToggleOverlay = vi.fn();
    render(<OverlayPanel toggles={TOGGLES} onToggleOverlay={onToggleOverlay} />);

    fireEvent.click(screen.getByRole("switch", { name: "Domain colouring" }));

    expect(onToggleOverlay).toHaveBeenCalledWith("domain-colouring");
  });

  // AC-2: mutual exclusion -- a disabled sibling stays keyboard-reachable
  // (never removed from the tab order) but can't be activated until the
  // active one is turned off first.
  // disables a sibling overlay's switch while another is active, without
  // hiding it (AC-2) -- invariants-explorer.md M2 delta
  it("test_overlay_mutual_exclusion", () => {
    const toggles: OverlayToggle[] = [{ ...TOGGLES[0]!, active: true }, { ...TOGGLES[1]!, disabled: true }];
    render(<OverlayPanel toggles={toggles} onToggleOverlay={vi.fn()} />);

    const domainSwitch = screen.getByRole("switch", { name: "Domain colouring" });
    expect(domainSwitch).toBeDisabled();
  });

  // refit deferred item 1: a pending toggle (e.g. Change heatmap, no data
  // source yet) carries its own reason instead of the generic mutual-
  // exclusion message.
  it("shows a toggle's own disabledReason instead of the generic mutual-exclusion tooltip", () => {
    const toggles: OverlayToggle[] = [
      { id: "change-heatmap", label: "Change heatmap (pending)", active: false, disabled: true, disabledReason: "No per-entity change-frequency data source yet -- see gap G17." },
    ];
    render(<OverlayPanel toggles={toggles} onToggleOverlay={vi.fn()} />);

    expect(screen.getByRole("switch", { name: "Change heatmap (pending)" })).toHaveAttribute(
      "title",
      "No per-entity change-frequency data source yet -- see gap G17."
    );
  });
});
