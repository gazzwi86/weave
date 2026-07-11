import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RelativeTime } from "../RelativeTime";

// AC-9: a raw ISO timestamp never renders as primary text -- only the
// relative label is visible; the ISO string is the hover/expand affordance.
describe("RelativeTime", () => {
  it("shows a friendly relative label, not the raw ISO string, as its text content", () => {
    const iso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    render(<RelativeTime iso={iso} />);
    const el = screen.getByText(/hour ago/i);
    expect(el.textContent).not.toBe(iso);
  });

  it("carries the raw ISO string as the hover tooltip (title) and dateTime attr", () => {
    const iso = "2026-07-01T12:00:00.000Z";
    render(<RelativeTime iso={iso} />);
    const el = screen.getByTitle(iso);
    expect(el).toHaveAttribute("dateTime", iso);
  });
});
