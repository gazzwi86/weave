import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandPalette } from "../command-palette";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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
});
