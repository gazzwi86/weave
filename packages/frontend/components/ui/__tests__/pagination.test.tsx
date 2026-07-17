import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "../pagination";

describe("Pagination", () => {
  it("renders the range label and every page button when few pages", () => {
    render(<Pagination page={1} pageCount={3} rangeLabel="Showing 1–8 of 23" onPageChange={vi.fn()} />);
    expect(screen.getByText("Showing 1–8 of 23")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("collapses a long page run with an ellipsis", () => {
    render(<Pagination page={12} pageCount={40} rangeLabel="Showing 111–120 of 400" onPageChange={vi.fn()} />);
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "40" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12" })).toHaveAttribute("aria-current", "page");
  });

  it("disables Previous on the first page and Next on the last page", () => {
    render(<Pagination page={1} pageCount={3} rangeLabel="x" onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
  });

  it("calls onPageChange with the clicked page", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={3} rangeLabel="x" onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with page + 1 when Next is clicked", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={3} rangeLabel="x" onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
