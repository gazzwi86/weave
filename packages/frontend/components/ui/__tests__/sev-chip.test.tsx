import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SevChip } from "../sev-chip";

describe("SevChip", () => {
  it.each(["violation", "warning", "info", "critical", "normal"] as const)(
    "renders the %s label",
    (severity) => {
      render(<SevChip severity={severity} />);
      expect(screen.getByText(severity)).toBeInTheDocument();
    }
  );

  it("tints violation and critical with the danger colour", () => {
    render(<SevChip severity="critical" />);
    expect(screen.getByText("critical").className).toContain("--color-danger");
  });
});
