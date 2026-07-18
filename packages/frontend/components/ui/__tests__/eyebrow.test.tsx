import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Eyebrow } from "../eyebrow";

describe("Eyebrow", () => {
  it("renders uppercase overline-tracked text at --text-overline, muted tone by default", () => {
    render(<Eyebrow>Needs you</Eyebrow>);
    const el = screen.getByText("Needs you");
    expect(el.className).toContain("text-[length:var(--text-overline)]");
    expect(el.className).toContain("tracking-[var(--text-overline-tracking)]");
    expect(el.className).toContain("uppercase");
    expect(el.className).toContain("text-[var(--color-text-muted)]");
  });

  it("uses the accent token when tone is accent", () => {
    render(<Eyebrow tone="accent">Home</Eyebrow>);
    const el = screen.getByText("Home");
    expect(el.className).toContain("text-[var(--color-accent-primary)]");
  });

  it("renders as a <p> by default and as the given element via the as prop", () => {
    render(<Eyebrow as="h2">Get going</Eyebrow>);
    expect(screen.getByRole("heading", { level: 2, name: "Get going" })).toBeInTheDocument();
  });
});
