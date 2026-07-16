import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspacesPanel } from "../workspaces-panel";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const WORKSPACES = [
  {
    id: "ws-1",
    slug: "ops",
    display_name: "Operations",
    named_graph_iri: "https://weave.example/graphs/ws-1",
    created_at: "2026-07-01T00:00:00Z",
  },
];

const EMPTY_STATE = "No workspaces yet.";

function fillAndSubmit(displayName: string, slug: string): void {
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: displayName } });
  fireEvent.change(screen.getByLabelText("Slug"), { target: { value: slug } });
  fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
}

describe("WorkspacesPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the tenant's workspaces", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(WORKSPACES)));

    render(<WorkspacesPanel />);

    await waitFor(() => expect(screen.getByText("Operations")).toBeInTheDocument());
    expect(screen.getByTestId("workspace-row")).toHaveTextContent("ops");
  });

  // Guards the practice-mode entry point stays mounted -- an orphaned
  // DemoWorkspaceCard is why the banner never appeared in a QA sweep.
  it("renders the Hammerbarn demo entry (Enter practice mode)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(WORKSPACES)));

    render(<WorkspacesPanel />);

    expect(await screen.findByRole("button", { name: /Enter practice mode/i })).toBeInTheDocument();
  });

  it("shows the empty state when there are no workspaces", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));

    render(<WorkspacesPanel />);

    await waitFor(() => expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument());
  });

  it("shows a load error when the list fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "upstream_unavailable" }, 502))
    );

    render(<WorkspacesPanel />);

    await waitFor(() => expect(screen.getByTestId("workspaces-error")).toBeInTheDocument());
  });

  it("creates a workspace, clears the form, and reloads the list", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse(WORKSPACES[0], 201);
      }
      return jsonResponse(fetchMock.mock.calls.length > 2 ? WORKSPACES : []);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkspacesPanel />);
    await waitFor(() => expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument());

    fillAndSubmit("Operations", "ops");

    await waitFor(() => expect(screen.getByText("Operations")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tenancy/workspaces",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ slug: "ops", display_name: "Operations" }),
      })
    );
    expect(screen.getByLabelText("Slug")).toHaveValue("");
    expect(screen.getByLabelText("Display name")).toHaveValue("");
  });

  it("shows the slug-taken message on a 409", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse({ detail: { error: "workspace_slug_taken" } }, 409);
      }
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkspacesPanel />);
    await waitFor(() => expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument());

    fillAndSubmit("Operations", "ops");

    await waitFor(() =>
      expect(screen.getByTestId("create-error")).toHaveTextContent("That slug is already taken.")
    );
  });

  it("shows a muted failure message on other create errors", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse({ detail: "boom" }, 500);
      }
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkspacesPanel />);
    await waitFor(() => expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument());

    fillAndSubmit("Operations", "ops");

    await waitFor(() =>
      expect(screen.getByTestId("create-error")).toHaveTextContent(
        "Unable to create the workspace."
      )
    );
  });
});
