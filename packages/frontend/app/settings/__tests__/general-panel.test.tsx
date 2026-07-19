import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GeneralPanel } from "../general-panel";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubMatchMedia(matches: Record<string, boolean>) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matches[query] ?? false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
}

const WORKSPACES = [
  {
    id: "w1",
    slug: "acme-one",
    display_name: "Acme One",
    named_graph_iri: "urn:w1",
    description: "Original description.",
    created_at: "2026-01-01",
  },
  { id: "w2", slug: "acme-two", display_name: "Acme Two", named_graph_iri: "urn:w2", created_at: "2026-01-02" },
];

function stubFetch(
  activeId: string | null,
  workspaces = WORKSPACES,
  workspacesStatus = 200,
  putHandler?: (url: string, init: RequestInit) => Response
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/tenancy/workspaces/active") return jsonResponse({ workspace_id: activeId });
      if (url === "/api/tenancy/workspaces") return jsonResponse(workspaces, workspacesStatus);
      if (init?.method === "PUT" && putHandler) return putHandler(url, init);
      throw new Error(`unexpected fetch: ${url}`);
    })
  );
}

describe("GeneralPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubMatchMedia({});
  });

  it("binds the active workspace's name into the read-only Name field", async () => {
    stubFetch("w2");

    render(<GeneralPanel />);

    await waitFor(() => expect(screen.getByLabelText("Workspace name")).toHaveValue("Acme Two"));
    expect(screen.getByLabelText("Workspace name")).toBeDisabled();
  });

  it("falls back to the first workspace when the caller has never switched (active id null)", async () => {
    stubFetch(null);

    render(<GeneralPanel />);

    await waitFor(() => expect(screen.getByLabelText("Workspace name")).toHaveValue("Acme One"));
  });

  it("shows a load-error message when the workspace fetch fails", async () => {
    stubFetch("w1", [], 500);

    render(<GeneralPanel />);

    await waitFor(() => expect(screen.getByTestId("workspace-error")).toBeInTheDocument());
  });

  it("locks Region -- no endpoint exists for it yet", async () => {
    stubFetch("w1");

    render(<GeneralPanel />);

    await waitFor(() => expect(screen.getByLabelText("Workspace name")).toHaveValue("Acme One"));
    expect(screen.getByLabelText("Workspace region")).toBeDisabled();
  });

  it("binds Description from the active workspace and enables editing", async () => {
    stubFetch("w1");

    render(<GeneralPanel />);

    await waitFor(() => expect(screen.getByLabelText("Workspace description")).toHaveValue("Original description."));
    expect(screen.getByLabelText("Workspace description")).not.toBeDisabled();
  });

  it("saves the description on blur via PUT /api/tenancy/workspaces/{id}", async () => {
    const putHandler = vi.fn((_url: string, init: RequestInit) =>
      jsonResponse({ ...WORKSPACES[0], description: JSON.parse(init.body as string).description })
    );
    stubFetch("w1", WORKSPACES, 200, putHandler);

    render(<GeneralPanel />);

    const field = await screen.findByLabelText("Workspace description");
    fireEvent.change(field, { target: { value: "Updated description." } });
    fireEvent.blur(field);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/tenancy/workspaces/w1",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ description: "Updated description." }) })
      )
    );
  });

  it("shows a save-error message when the description save fails", async () => {
    const putHandler = vi.fn(() => jsonResponse({ error: "save_failed" }, 500));
    stubFetch("w1", WORKSPACES, 200, putHandler);

    render(<GeneralPanel />);

    const field = await screen.findByLabelText("Workspace description");
    fireEvent.change(field, { target: { value: "Updated description." } });
    fireEvent.blur(field);

    await waitFor(() => expect(screen.getByText("Couldn't save the description.")).toBeInTheDocument());
  });

  it("seeds the Appearance toggles from the OS matchMedia read", async () => {
    stubFetch("w1");
    stubMatchMedia({
      "(prefers-color-scheme: dark)": true,
      "(prefers-reduced-motion: reduce)": true,
    });

    render(<GeneralPanel />);

    await waitFor(() => expect(screen.getByTestId("toggle-theme")).toBeChecked());
    expect(screen.getByTestId("toggle-reduced-motion")).toBeChecked();
  });

  it("flips Appearance toggles locally on click (display-only, no persistence)", async () => {
    stubFetch("w1");

    render(<GeneralPanel />);

    await waitFor(() => expect(screen.getByLabelText("Workspace name")).toHaveValue("Acme One"));
    expect(screen.getByTestId("toggle-theme")).not.toBeChecked();
    fireEvent.click(screen.getByTestId("toggle-theme"));
    expect(screen.getByTestId("toggle-theme")).toBeChecked();
  });
});
