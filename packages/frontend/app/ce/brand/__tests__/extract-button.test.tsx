import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ExtractButton } from "../extract-button";

describe("ExtractButton", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no axe violations", async () => {
    const { container } = render(<ExtractButton />);
    expect((await axe(container)).violations).toHaveLength(0);
  });

  // AC-004-04: the extraction affordance always 503s (E4-S2 deferred); the
  // button stays enabled and re-clickable, it just explains itself.
  it("shows the 503 unavailable state on click and stays enabled", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    render(<ExtractButton />);

    const button = screen.getByRole("button", { name: /extract from source/i });
    fireEvent.click(button);

    expect(await screen.findByText(/extraction isn't available yet/i)).toBeInTheDocument();
    expect(button).toBeEnabled();
  });
});
