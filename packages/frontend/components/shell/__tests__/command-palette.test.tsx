import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandPalette } from "../command-palette";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  // Not "/dashboard" -- that route's PromptBar owns Cmd+K instead (AC-8).
  usePathname: () => "/ce",
}));

function stubSearchFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [{ iri: "urn:weave:entity:acme", label: "Acme Corp", kind: "Organization" }],
          total: 1,
        }),
        { status: 200 }
      )
    )
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    pushMock.mockClear();
    stubSearchFetch();
  });

  it("opens on Cmd+K, focuses the input, and closes on Escape", async () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = await screen.findByRole("combobox");
    expect(input).toHaveFocus();

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows matching results after typing 2+ characters", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = await screen.findByRole("combobox");

    fireEvent.change(input, { target: { value: "ac" } });

    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/search?q=ac"),
      expect.anything()
    );
  });

  it("navigates to /ce/resource?iri=... when a result is selected", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "ac" } });

    const result = await screen.findByText("Acme Corp");
    fireEvent.click(result);

    expect(pushMock).toHaveBeenCalledWith(
      "/ce/resource?iri=urn%3Aweave%3Aentity%3Aacme"
    );
  });

  // PR #13 finding (4): backend-down must read as "Search unavailable", not
  // a silent "No results." (which looks identical to a real empty search).
  it("shows a distinguishable message when search fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Bad Gateway</html>", { status: 502 }))
    );
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = await screen.findByRole("combobox");

    fireEvent.change(input, { target: { value: "ac" } });

    await waitFor(() => expect(screen.getByText("Search unavailable.")).toBeInTheDocument());
    expect(screen.queryByText("No results.")).not.toBeInTheDocument();
  });

  // AC-3: renders above modals (--z-command) and shows keyboard hints.
  it("renders at --z-command with keyboard hints visible", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const dialog = await screen.findByRole("dialog");

    expect(dialog.className).toContain("z-[var(--z-command)]");
    expect(screen.getByText(/enter to select/i)).toBeInTheDocument();
    expect(screen.getByText(/esc to dismiss/i)).toBeInTheDocument();
  });

  // AC-3: results are grouped into Navigation / Entities / Actions, and
  // typing a nav-area label surfaces it under the Navigation group without
  // hitting the entity search endpoint.
  it("groups results into Navigation / Entities / Actions", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = await screen.findByRole("combobox");

    fireEvent.change(input, { target: { value: "constit" } });

    expect(await screen.findByRole("group", { name: "Navigation" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Constitution" })).toBeInTheDocument();
  });

  // AC-3: selecting a Navigation result navigates via the router, not a
  // resource-detail route (that's the Entities group's job).
  it("navigates to a Navigation result's href when selected", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "constit" } });

    const navResult = await screen.findByRole("option", { name: "Constitution" });
    fireEvent.click(navResult);

    expect(pushMock).toHaveBeenCalledWith("/ce");
  });

  // S5(a): the top-bar trigger button opens the palette via the
  // weave:open-command-palette window event (bypassing the Cmd+K route
  // guard) -- the input must be focused on that path too, not just Cmd+K.
  it("focuses the input when opened via the trigger button event", async () => {
    render(<CommandPalette />);
    fireEvent(window, new CustomEvent("weave:open-command-palette"));

    const input = await screen.findByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
  });

  // S5(b): before the user types anything, the palette should show an idle
  // hint, not "No results." -- that copy is reserved for an actual
  // non-matching query (see the next test).
  it("shows an idle state, not 'No results.', immediately after opening", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await screen.findByRole("combobox");

    expect(screen.queryByText("No results.")).not.toBeInTheDocument();
  });

  it("shows 'No results.' once a non-matching query is typed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ results: [], total: 0 }), { status: 200 }))
    );
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = await screen.findByRole("combobox");

    fireEvent.change(input, { target: { value: "zzzzz" } });

    await waitFor(() => expect(screen.getByText("No results.")).toBeInTheDocument());
  });

  // TASK-011 AC-8: the dashboard's PromptBar owns Cmd+K on /dashboard --
  // the global palette must not also react there (no double-bind).
  // Kept last -- it mocks usePathname without restoring, which would leak
  // into later tests (no restoreMocks in vitest.config).
  it("does not open on Cmd+K when the route is /dashboard", async () => {
    const navigation = await import("next/navigation");
    vi.spyOn(navigation, "usePathname").mockReturnValue("/dashboard");

    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
