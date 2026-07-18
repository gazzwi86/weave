import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PolicyCards } from "../policy-cards";

describe("PolicyCards", () => {
  it("shows an honest empty state with no rows", () => {
    render(<PolicyCards rows={[]} onAttach={vi.fn()} />);
    expect(screen.getByText("No policies yet.")).toBeInTheDocument();
  });

  it("renders one card per policy with an Attach action", () => {
    const onAttach = vi.fn();
    render(
      <PolicyCards
        rows={[{ iri: "urn:weave:instances:policy-1", label: "Vendor risk policy" }]}
        onAttach={onAttach}
      />
    );

    expect(screen.getByText("Vendor risk policy")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Attach"));
    expect(onAttach).toHaveBeenCalledWith({ iri: "urn:weave:instances:policy-1", label: "Vendor risk policy" });
  });
});
