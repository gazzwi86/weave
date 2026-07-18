import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KpiStrip } from "../KpiStrip";

describe("KpiStrip", () => {
  it("renders a value and label per item", () => {
    render(
      <KpiStrip
        items={[
          { value: "1,240", label: "entities" },
          { value: "3,482", label: "relations" },
          { value: "0", label: "violations", variant: "ok" },
          { value: "v14", label: "published" },
        ]}
      />
    );
    expect(screen.getByText("1,240")).toBeInTheDocument();
    expect(screen.getByText("entities")).toBeInTheDocument();
    expect(screen.getByText("violations")).toBeInTheDocument();
  });

  it("gives the ok variant its success colour, meaning still riding on the label text", () => {
    render(<KpiStrip items={[{ value: "0", label: "violations", variant: "ok" }]} />);
    expect(screen.getByText("0")).toHaveClass("text-[var(--color-success)]");
  });

  it("does not warn on duplicate React keys when two items share a label", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <KpiStrip
        items={[
          { value: "3", label: "changes" },
          { value: "1", label: "changes" },
        ]}
      />
    );
    expect(errorSpy.mock.calls.join(" ")).not.toMatch(/same key/i);
    errorSpy.mockRestore();
  });
});
