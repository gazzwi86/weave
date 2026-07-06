import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "../page";

describe("Home (marketing index)", () => {
  it("renders the hero with login CTAs", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "The operating system for the AI-native company" })
    ).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: "Get started" });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/auth/login");
    }
  });

  it("renders how-it-works, pricing tiers, and footer", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Enterprise" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeInTheDocument();
  });
});
