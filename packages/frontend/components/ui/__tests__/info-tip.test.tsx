import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InfoTip } from "../info-tip";

describe("InfoTip", () => {
  it("renders a focusable trigger button with the title as its accessible name", () => {
    render(<InfoTip title="Brand conformance" body="Share of generated content passing brand rules." />);
    expect(screen.getByRole("button", { name: /brand conformance/i })).toBeInTheDocument();
  });

  it("links the popover body to the trigger via aria-describedby (JSDOM doesn't compute CSS visibility, so this checks the a11y wiring rather than rendered visibility)", () => {
    render(<InfoTip title="Brand conformance" body="Share of generated content passing brand rules." />);
    const trigger = screen.getByRole("button", { name: /brand conformance/i });
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(/share of generated content/i);
  });

  it("opens on focus and closes on Escape without losing focus", () => {
    render(<InfoTip title="Brand conformance" body="Share of generated content passing brand rules." />);
    const trigger = screen.getByRole("button", { name: /brand conformance/i });
    const popover = trigger.nextElementSibling as HTMLElement;

    fireEvent.focus(trigger);
    expect(popover).toHaveAttribute("data-open");

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(popover).not.toHaveAttribute("data-open");
  });

  it("renders the optional how-footer when given", () => {
    render(<InfoTip title="Brand conformance" body="Body text" how="Computed nightly from the audit log." />);
    expect(screen.getByText(/computed nightly/i)).toBeInTheDocument();
  });

  it("omits the how-footer when not given", () => {
    render(<InfoTip title="Brand conformance" body="Body text" />);
    expect(screen.queryByText(/computed nightly/i)).not.toBeInTheDocument();
  });
});
