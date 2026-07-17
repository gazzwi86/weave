import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar, type FilterChip } from "../filter-bar";

const CHIPS: FilterChip[] = [
  { id: "all", label: "All", color: "red" },
  { id: "relationships", label: "Relationships" },
];

describe("FilterBar", () => {
  it("renders a chip per entry with pressed state reflecting activeIds", () => {
    render(<FilterBar chips={CHIPS} activeIds={["all"]} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Relationships" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onToggle with the chip id when clicked", () => {
    const onToggle = vi.fn();
    render(<FilterBar chips={CHIPS} activeIds={["all"]} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Relationships" }));
    expect(onToggle).toHaveBeenCalledWith("relationships");
  });

  it("omits the search input when search is not given", () => {
    render(<FilterBar chips={CHIPS} activeIds={[]} onToggle={vi.fn()} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders the search input when search is given", () => {
    render(
      <FilterBar
        chips={CHIPS}
        activeIds={[]}
        onToggle={vi.fn()}
        search={{ value: "", onChange: vi.fn(), label: "Search kinds", placeholder: "Search kinds" }}
      />
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders the trailing slot", () => {
    render(<FilterBar chips={CHIPS} activeIds={[]} onToggle={vi.fn()} trailing={<span>Sort: name</span>} />);
    expect(screen.getByText("Sort: name")).toBeInTheDocument();
  });
});
