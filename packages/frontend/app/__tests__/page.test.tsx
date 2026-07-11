import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LANDING_PAGE_SECTION_ORDER } from "@/components/templates/landing-page";

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

  // AC-3 / test_existing_sections_content_unchanged_after_template_refit
  it("renders how-it-works, pricing tiers, and footer unchanged", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1. Model" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2. Ask & see" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3. Generate" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Four engines, one platform" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Starter" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Enterprise" })).toBeInTheDocument();
    expect(screen.getByText("Talk to us")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeInTheDocument();
  });

  // AC-2 / test_marketing_index_section_order_matches_ia
  it("renders all nine IA sections present on the page", () => {
    render(<Home />);
    expect(screen.getByRole("banner")).toBeInTheDocument(); // header
    expect(screen.getByRole("heading", { name: /operating system/i })).toBeInTheDocument(); // hero
    expect(screen.getByLabelText("Social proof")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Four engines, one platform" })).toBeInTheDocument();
    expect(screen.getByLabelText("Product screenshots")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ready to model your company?" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument(); // footer
  });

  // AC-2 / test_marketing_index_section_order_matches_ia
  it("fixes the nine IA sections in the exact §6 order", () => {
    const kinds: string[] = [...LANDING_PAGE_SECTION_ORDER];
    expect(kinds).toEqual([
      "header",
      "hero",
      "social-proof",
      "how-it-works",
      "feature-grid",
      "screenshot-band",
      "pricing",
      "final-cta",
      "footer",
    ]);
  });

  // AC-5 / test_landing_page_template_added_before_binding_content (static half)
  it("composes app/page.tsx as a thin binder onto the landing-page template, no direct marketing-molecule JSX", () => {
    const source = readFileSync(path.join(__dirname, "../page.tsx"), "utf-8");
    expect(source).toMatch(/LandingPageTemplate/);
    expect(source).not.toMatch(/components\/marketing\/(hero|features|pricing-footer|cta-link)/);
  });
});
