import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OverlayKey, type OverlaySection } from "../OverlayKey";

const SECTIONS: OverlaySection[] = [
  {
    id: "heat",
    label: "heat",
    rows: [
      { colorVar: "--color-danger", label: "changed 5+ times this month" },
      { colorVar: "--color-warn", label: "changed 2–4 times" },
      { colorVar: "--color-border-strong", label: "stable" },
    ],
  },
  {
    id: "diff",
    label: "diff v13 → v14",
    rows: [
      { colorVar: "--color-success", label: "added in v14" },
      { colorVar: "--color-danger", label: "removed (ghost)" },
    ],
  },
];

describe("OverlayKey", () => {
  it("renders an uppercase section label per active overlay", () => {
    render(<OverlayKey sections={SECTIONS} />);
    expect(screen.getByText("heat")).toBeInTheDocument();
    expect(screen.getByText("diff v13 → v14")).toBeInTheDocument();
  });

  it("renders a swatch row per legend entry, one section's rows all showing", () => {
    render(<OverlayKey sections={SECTIONS} />);
    expect(screen.getByText("changed 5+ times this month")).toBeInTheDocument();
    expect(screen.getByText("stable")).toBeInTheDocument();
    expect(screen.getByText("added in v14")).toBeInTheDocument();
  });

  it("renders nothing when no overlay is active", () => {
    const { container } = render(<OverlayKey sections={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
