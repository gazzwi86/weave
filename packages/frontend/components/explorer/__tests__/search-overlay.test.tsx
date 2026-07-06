import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchOverlay } from "../search-overlay";

describe("SearchOverlay", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <SearchOverlay open={false} query="" results={[]} noResults={false} onQueryChange={vi.fn()} onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the search input and the result list when open", () => {
    render(
      <SearchOverlay
        open
        query="onboard"
        results={[{ id: "n1", label: "Customer Onboarding", typeLabel: "Process" }]}
        noResults={false}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("textbox")).toHaveValue("onboard");
    expect(screen.getByText("Customer Onboarding")).toBeInTheDocument();
  });

  // AC-7: zero matches -> explicit "No results found" message.
  it("shows 'No results found' when noResults is true", () => {
    render(
      <SearchOverlay open query="nonexistent" results={[]} noResults onQueryChange={vi.fn()} onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it("calls onSelect with the node id when a result is clicked", () => {
    const onSelect = vi.fn();
    render(
      <SearchOverlay
        open
        query="onboard"
        results={[{ id: "n1", label: "Customer Onboarding", typeLabel: "Process" }]}
        noResults={false}
        onQueryChange={vi.fn()}
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    );
    screen.getByText("Customer Onboarding").click();
    expect(onSelect).toHaveBeenCalledWith("n1");
  });
});
