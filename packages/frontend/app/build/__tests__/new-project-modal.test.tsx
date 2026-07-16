import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewProjectModal } from "../new-project-modal";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("NewProjectModal", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    HTMLDialogElement.prototype.showModal ??= function mockShowModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function mockClose(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });

  it("creates a project on save and reports the new id (AC-8)", async () => {
    const onCreated = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            project_iri: "urn:weave:project:p-9",
            pinned_graph_version_iri: "urn:weave:graph:v-1",
            created_at: "2026-07-10T00:00:00Z",
            lifecycle_phase: "Speccing",
          },
          201
        )
      )
    );

    render(<NewProjectModal onCreated={onCreated} />);
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ledger Sync" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith("urn:weave:project:p-9")
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/build/projects",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows the source-control secret reference as a name-only chip, no reveal control (AC-6)", () => {
    render(<NewProjectModal onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Secret reference (optional)"), {
      target: { value: "gh-token-prod" },
    });

    expect(screen.getByText("gh-token-prod")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reveal/i })).not.toBeInTheDocument();
  });

  it("shows a name-conflict error and keeps the dialog open on a 409", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 409)));

    render(<NewProjectModal onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ledger Sync" } });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Reconciliation pipeline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i)
    );
    expect(screen.getByLabelText("Description")).toHaveValue("Reconciliation pipeline");
  });

  it("shows a generic error when the create request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    render(<NewProjectModal onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ledger Sync" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/try again shortly/i)
    );
  });

  it("shows an inline error and does not submit when Name is empty (BUG-04)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<NewProjectModal onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Name is required.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes the dialog without creating a project on Cancel", () => {
    render(<NewProjectModal onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute("open");
  });
});
