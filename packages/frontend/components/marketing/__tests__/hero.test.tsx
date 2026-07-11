import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Hero, MarketingHeader } from "@/components/marketing/hero";

describe("Hero (AC-1)", () => {
  it("should render the hero section with a real screenshot asset, not the CSS MockGraphPanel", () => {
    render(<Hero />);
    const image = screen.getByRole("img", { name: /explorer graph canvas/i });
    expect(image).toHaveAttribute("src", "/marketing/hero-canvas.png");
    // The old MockGraphPanel rendered aria-hidden colour dots with no <img>.
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });
});

describe("MarketingHeader logo (AC-4)", () => {
  it("should render the header with the full logo lockup asset, never the raw cropped PNG", () => {
    render(<MarketingHeader />);
    const logo = screen.getByRole("img", { name: /weave/i });
    expect(logo).toHaveAttribute("src", "/logo-lockup.png");
    expect(logo).not.toHaveAttribute("src", "/logo.png");
  });
});
