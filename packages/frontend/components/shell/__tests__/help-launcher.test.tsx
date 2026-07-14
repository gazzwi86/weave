import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HelpLauncher } from "../help-launcher";

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("HelpLauncher", () => {
  it("opens a contextual help panel without navigating away (AC-7)", () => {
    render(<HelpLauncher />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.getByRole("dialog", { name: /help/i })).toBeInTheDocument();
  });

  it("closes when dismissed", () => {
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close help/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers the completeness-map tour deep-link only on Explorer routes (ONB-V1-TASK-002 AC-002-01)", () => {
    pathname = "/explorer";
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.getByRole("link", { name: /take the completeness-map tour/i })).toHaveAttribute(
      "href",
      "/explorer?tour=completeness-map",
    );
  });

  it("does not offer the completeness-map tour deep-link off Explorer routes", () => {
    pathname = "/dashboard";
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.queryByRole("link", { name: /take the completeness-map tour/i })).not.toBeInTheDocument();
  });
});
