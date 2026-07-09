import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegistryGrid } from "../registry-grid";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const CARDS = [
  {
    project_iri: "urn:weave:project:p-1",
    name: "Ledger Sync",
    created_at: "2026-07-01T00:00:00Z",
    lifecycle_phase: "Speccing",
    owner_iri: "urn:weave:principal:user:admin",
  },
  {
    project_iri: "urn:weave:project:p-2",
    name: "Claims Triage",
    created_at: "2026-06-15T00:00:00Z",
    lifecycle_phase: "Live monitoring",
    owner_iri: null,
  },
];

describe("RegistryGrid", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a filtered, searchable registry grid (AC-1)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ items: CARDS, next_cursor: null }))
    );

    render(<RegistryGrid />);

    await waitFor(() => expect(screen.getByText("Ledger Sync")).toBeInTheDocument());
    expect(screen.getByText("Claims Triage")).toBeInTheDocument();
    expect(screen.getByText("Speccing", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Live monitoring", { selector: "span" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search projects"), {
      target: { value: "ledger" },
    });

    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("search=ledger"),
        expect.anything()
      )
    );
  });

  it("shows an empty state with a clear-filters action when nothing matches (AC-2)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ items: [], next_cursor: null }))
    );

    render(<RegistryGrid />);

    await waitFor(() =>
      expect(screen.getByText(/no projects match/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });
});
