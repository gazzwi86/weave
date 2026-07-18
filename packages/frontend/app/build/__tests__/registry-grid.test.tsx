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
    // Phase pill uses the mock's own vocabulary (building/live/archived/
    // speccing), not the API's lifecycle_phase string verbatim -- see
    // project-card.test.tsx.
    expect(screen.getByText("speccing", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("live", { selector: "span" })).toBeInTheDocument();

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

  // Filter row restyle (V4): the phase filter is now a chip row (mock's
  // `.filter-bar` idiom, refit-mock.html #sub-types), not a <select> --
  // toggling a phase chip must still reach the backend query param.
  it("filters by lifecycle phase via the restyled chip row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ items: CARDS, next_cursor: null }))
    );

    render(<RegistryGrid />);

    await waitFor(() => expect(screen.getByText(CARDS[0]!.name)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Building" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("lifecycle_phase=Building"),
        expect.anything()
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "All phases" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        expect.not.stringContaining("lifecycle_phase"),
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

  // QA edge case (TASK-015): the grid's network-failure path (`loadError`)
  // had zero test coverage -- `use-project-grid.ts`'s catch branch was
  // never exercised. A non-ok response must surface the alert, not a blank
  // or perpetually-loading grid.
  it("shows a load-error alert when the grid fetch fails, not a blank or stuck grid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    );

    render(<RegistryGrid />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/unable to load projects/i)
    );
    expect(screen.queryByText(/no projects match/i)).not.toBeInTheDocument();
  });
});
