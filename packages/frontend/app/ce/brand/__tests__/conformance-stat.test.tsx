import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConformanceStat } from "../conformance-stat";

describe("ConformanceStat", () => {
  // G14 (remediation-2-api-gaps.md): no backend aggregation endpoint exists
  // yet -- this must render an honest pending state, never a fabricated 0%
  // or 100%.
  it("shows a pending value with a note explaining why, not a fake number", () => {
    render(<ConformanceStat />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/brand conformance/i)).toBeInTheDocument();
    expect(screen.getByText(/not yet available/i)).toBeInTheDocument();
  });
});
