import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InfoTip } from "../info-tip";

describe("InfoTip", () => {
  it("renders a focusable trigger button with the title as its accessible name", () => {
    render(<InfoTip title="Brand conformance" body="Share of generated content passing brand rules." />);
    expect(screen.getByRole("button", { name: /brand conformance/i })).toBeInTheDocument();
  });

  it("renders the popover body content (always in the DOM, CSS controls visibility)", () => {
    render(<InfoTip title="Brand conformance" body="Share of generated content passing brand rules." />);
    expect(screen.getByText(/share of generated content/i)).toBeInTheDocument();
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
