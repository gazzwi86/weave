import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SidePanel } from "../side-panel";

describe("SidePanel", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SidePanel state={{ status: "closed" }} onClose={vi.fn()} onRetry={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the label and type while loading", () => {
    render(
      <SidePanel
        state={{ status: "loading", label: "Customer Onboarding", typeLabel: "Process" }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText("Customer Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Process")).toBeInTheDocument();
  });

  // AC-2: no raw IRI anywhere in the DOM for a non-ontologist role.
  it("shows properties and never renders a raw IRI when rawIri is null", () => {
    render(
      <SidePanel
        state={{
          status: "loaded",
          label: "Customer Onboarding",
          typeLabel: "Process",
          keyProperties: [{ path: "rdfs:comment", label: "Description", value: "Onboards a new customer" }],
          rawIri: null,
        }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText("Onboards a new customer")).toBeInTheDocument();
    expect(screen.queryByText(/https?:\/\//)).not.toBeInTheDocument();
    expect(screen.queryByText(/advanced/i)).not.toBeInTheDocument();
  });

  // AC-2: the ontologist role gets a disclosed raw IRI.
  it("discloses the raw IRI under an 'Advanced' section when rawIri is set", () => {
    const iri = "https://weave.example/entity/cust-onboarding";
    render(
      <SidePanel
        state={{ status: "loaded", label: "Customer Onboarding", typeLabel: "Process", keyProperties: [], rawIri: iri }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText(/advanced/i)).toBeInTheDocument();
    expect(screen.getByText(iri)).toBeInTheDocument();
  });

  // AC-3: generic fallback keeps label/type and offers retry.
  it("shows the 'Details unavailable' fallback with a retry action on error", () => {
    const onRetry = vi.fn();
    render(
      <SidePanel state={{ status: "error", label: "Customer Onboarding", typeLabel: "Process" }} onClose={vi.fn()} onRetry={onRetry} />
    );
    expect(screen.getByText("Customer Onboarding")).toBeInTheDocument();
    expect(screen.getByText(/details unavailable/i)).toBeInTheDocument();
    screen.getByRole("button", { name: /retry/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });

  // AC-8: "Not found" only -- no label/type/properties leak through.
  it("shows only 'Not found' and no other content when not-found", () => {
    render(<SidePanel state={{ status: "not-found" }} onClose={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <SidePanel
        state={{ status: "loaded", label: "Customer Onboarding", typeLabel: "Process", keyProperties: [], rawIri: null }}
        onClose={onClose}
        onRetry={vi.fn()}
      />
    );
    screen.getByRole("button", { name: /close/i }).click();
    expect(onClose).toHaveBeenCalled();
  });
});
