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
  it("disables a sibling overlay's switch while another is active, without hiding it (AC-2)", () => {
    const toggles: OverlayToggle[] = [{ ...TOGGLES[0]!, active: true }, { ...TOGGLES[1]!, disabled: true }];
    render(<OverlayPanel toggles={toggles} onToggleOverlay={vi.fn()} />);

    const domainSwitch = screen.getByRole("switch", { name: "Domain colouring" });
    expect(domainSwitch).toBeDisabled();
  });
});
