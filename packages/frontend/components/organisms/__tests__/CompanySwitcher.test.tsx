import { render, screen } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { describe, expect, it, vi } from "vitest";

import { CompanySwitcher } from "../CompanySwitcher";

const COMPANIES = [
  { id: "ws-hammerbarn", name: "Hammerbarn" },
  { id: "ws-acme", name: "Acme Industrial" },
];

describe("CompanySwitcher", () => {
  it("renders the Company section label and one row per company", () => {
    render(<CompanySwitcher companies={COMPANIES} activeId="ws-hammerbarn" onSelect={vi.fn()} />);
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hammerbarn/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acme Industrial/ })).toBeInTheDocument();
  });

  it("marks the active company with aria-current and disables it", () => {
    render(<CompanySwitcher companies={COMPANIES} activeId="ws-hammerbarn" onSelect={vi.fn()} />);
    const active = screen.getByRole("button", { name: /Hammerbarn/ });
    expect(active).toHaveAttribute("aria-current", "true");
    expect(active).toBeDisabled();
  });

  it("calls onSelect with the company id when a non-active row is clicked", async () => {
    const onSelect = vi.fn();
    render(<CompanySwitcher companies={COMPANIES} activeId="ws-hammerbarn" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Acme Industrial/ }));
    expect(onSelect).toHaveBeenCalledWith("ws-acme");
  });

  it("shows a loading state instead of rows while loading", () => {
    render(<CompanySwitcher companies={[]} activeId={null} loading onSelect={vi.fn()} />);
    expect(screen.getByText(/loading companies/i)).toBeInTheDocument();
  });

  it("shows an error state when the list failed to load", () => {
    render(<CompanySwitcher companies={[]} activeId={null} error onSelect={vi.fn()} />);
    expect(screen.getByText(/couldn.t load companies/i)).toBeInTheDocument();
  });
});
