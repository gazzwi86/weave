import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StandardsCards } from "../standards-cards";
import type { BrandStandardRow } from "../types";

const ROWS: BrandStandardRow[] = [
  {
    iri: "urn:weave:instances:bs-1",
    contentType: "acme.tone",
    contentBody: "Be direct.",
    sourceUri: null,
    effectiveDate: "2026-01-01",
    owner: "Brand Team",
  },
];

describe("StandardsCards", () => {
  it("renders one policy card per standard with an Edit action", () => {
    const onEdit = vi.fn();
    render(<StandardsCards rows={ROWS} onEdit={onEdit} />);
    expect(screen.getByText("acme.tone")).toBeInTheDocument();
    expect(screen.getByText(/Brand Team/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(ROWS[0]);
  });

  // AC-004-03: per-row PROV-O attribution -- honest "unknown actor" when
  // this browser session didn't create the item (attribution.ts).
  it("shows the row's attribution when known", () => {
    const attributionFor = vi.fn(() => ({
      actorIri: "brand-owner@example.com",
      versionIri: "urn:v1",
      committedAt: "2026-01-01T00:00:00.000Z",
    }));
    render(<StandardsCards rows={ROWS} onEdit={vi.fn()} attributionFor={attributionFor} />);
    expect(screen.getByText(/brand-owner@example.com/)).toBeInTheDocument();
  });

  it("shows an empty state with zero standards", () => {
    render(<StandardsCards rows={[]} onEdit={vi.fn()} />);
    expect(screen.getByText(/no standards yet/i)).toBeInTheDocument();
  });
});
