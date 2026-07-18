import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatCard } from "../stat-card";

describe("StatCard", () => {
  it("renders the value and label", () => {
    render(<StatCard value="92%" label="brand conformance" />);
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("brand conformance")).toBeInTheDocument();
  });

  it("defaults to neutral tone (no ok/bad colour class)", () => {
    render(<StatCard value="14" label="active rules" />);
    const value = screen.getByText("14");
    expect(value.className).not.toContain("--color-success");
    expect(value.className).not.toContain("--color-danger");
  });

  it("tints the value success on tone=ok", () => {
    render(<StatCard value="0" label="critical rules failing" tone="ok" />);
    expect(screen.getByText("0").className).toContain("--color-success");
  });

  it("tints the value danger on tone=bad", () => {
    render(<StatCard value="2" label="violations" tone="bad" />);
    expect(screen.getByText("2").className).toContain("--color-danger");
  });
});
