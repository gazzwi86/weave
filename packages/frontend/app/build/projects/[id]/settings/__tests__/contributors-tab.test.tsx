import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContributorsTab } from "../contributors-tab";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const CONTRIBUTORS = {
  items: [
    {
      principal_iri: "urn:weave:principal:user:client",
      role: "editor",
      added_by: "urn:weave:principal:user:admin",
      added_at: "2026-07-01T00:00:00Z",
    },
  ],
};

describe("ContributorsTab", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists contributors with a role badge and explains read access is company-wide (AC-5)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(CONTRIBUTORS)));
    render(<ContributorsTab projectId="p-1" canManage={false} />);

    await waitFor(() =>
      expect(screen.getByText("urn:weave:principal:user:client")).toBeInTheDocument()
    );
    expect(screen.getByText("editor")).toBeInTheDocument();
    expect(screen.getByText(/company-wide/i)).toBeInTheDocument();
  });

  it("hides add/remove controls for a non-admin caller", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(CONTRIBUTORS)));
    render(<ContributorsTab projectId="p-1" canManage={false} />);

    await waitFor(() =>
      expect(screen.getByText("urn:weave:principal:user:client")).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New contributor principal")).not.toBeInTheDocument();
  });

  it("adds and removes a contributor for an admin caller", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(CONTRIBUTORS))
      .mockResolvedValueOnce(
        jsonResponse({
          principal_iri: "urn:weave:principal:user:new",
          role: "editor",
          added_by: "urn:weave:principal:user:admin",
          added_at: "2026-07-02T00:00:00Z",
        })
      )
      .mockResolvedValueOnce(jsonResponse({ items: [...CONTRIBUTORS.items] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ContributorsTab projectId="p-1" canManage={true} />);

    await waitFor(() =>
      expect(screen.getByText("urn:weave:principal:user:client")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText("New contributor principal"), {
      target: { value: "urn:weave:principal:user:new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add contributor" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/build/projects/p-1/contributors",
        expect.objectContaining({ method: "PUT" })
      )
    );

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0] as HTMLElement);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/build/projects/p-1/contributors/"),
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });
});
