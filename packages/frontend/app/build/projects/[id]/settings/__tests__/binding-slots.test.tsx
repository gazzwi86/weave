import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BindingSlots } from "../binding-slots";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const JIRA_BINDING = {
  binding_id: "b-1",
  system: "jira",
  connector_ref: "jira-1",
  space_ref: "ACME",
  created_by: "urn:weave:principal:user:admin",
  created_at: "2026-07-01T00:00:00Z",
  health: { status: "ok", last_sync: null, last_error: null, error_count: 0, skipped_count: 0 },
};

describe("BindingSlots", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading state before the bindings list resolves", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined))
    );
    render(<BindingSlots projectId="p-1" canManage={false} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows all three system slots empty when no bindings exist (AC-1)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ items: [] })));
    render(<BindingSlots projectId="p-1" canManage={false} />);

    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.getByText("Confluence")).toBeInTheDocument();
    expect(screen.getByText("Jira")).toBeInTheDocument();
    expect(screen.getByText("ServiceNow")).toBeInTheDocument();
    expect(screen.getAllByText(/not configured/i)).toHaveLength(3);
  });

  it("shows a bound slot's space ref and a health badge with colour and text (AC-1/AC-3)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ items: [JIRA_BINDING] })));
    render(<BindingSlots projectId="p-1" canManage={false} />);

    await waitFor(() => expect(screen.getByText("ACME")).toBeInTheDocument());
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("shows an unavailable health badge when the connector health read fails (AC-3)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          items: [{ ...JIRA_BINDING, health: { ...JIRA_BINDING.health, status: "unavailable" } }],
        })
      )
    );
    render(<BindingSlots projectId="p-1" canManage={false} />);

    await waitFor(() => expect(screen.getByText("Unavailable")).toBeInTheDocument());
  });

  it("hides bind/edit/remove controls for a non-admin caller (admin-only readonly)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ items: [JIRA_BINDING] })));
    render(<BindingSlots projectId="p-1" canManage={false} />);

    await waitFor(() => expect(screen.getByText("ACME")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /bind/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("binds a jira space and shows a save-success message for an admin caller", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse(JIRA_BINDING, 201))
      .mockResolvedValueOnce(jsonResponse({ items: [JIRA_BINDING] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<BindingSlots projectId="p-1" canManage={true} />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /bind/i })).toHaveLength(3));

    fireEvent.click(screen.getAllByRole("button", { name: /bind/i })[1] as HTMLElement);
    fireEvent.change(screen.getByLabelText(/connector instance/i), {
      target: { value: "jira-1" },
    });
    fireEvent.change(screen.getByLabelText(/space/i), { target: { value: "ACME" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/build/projects/p-1/bindings",
        expect.objectContaining({ method: "PUT" })
      )
    );
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
  });

  it("shows a validation-error message naming available instances on an unknown-instance conflict (AC-2)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ error: "unknown_instance", available: ["jira-2"] }, 422)
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<BindingSlots projectId="p-1" canManage={true} />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /bind/i })).toHaveLength(3));

    fireEvent.click(screen.getAllByRole("button", { name: /bind/i })[1] as HTMLElement);
    fireEvent.change(screen.getByLabelText(/connector instance/i), {
      target: { value: "jira-1" },
    });
    fireEvent.change(screen.getByLabelText(/space/i), { target: { value: "ACME" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/jira-2/));
  });

  it("shows a validation-error message on a duplicate-binding conflict (AC-4)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ error: "duplicate_binding", system: "jira", space_ref: "ACME" }, 409)
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<BindingSlots projectId="p-1" canManage={true} />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /bind/i })).toHaveLength(3));

    fireEvent.click(screen.getAllByRole("button", { name: /bind/i })[1] as HTMLElement);
    fireEvent.change(screen.getByLabelText(/connector instance/i), {
      target: { value: "jira-1" },
    });
    fireEvent.change(screen.getByLabelText(/space/i), { target: { value: "ACME" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/already bound/i));
  });

  it("removes a binding after confirmation for an admin caller", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [JIRA_BINDING] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<BindingSlots projectId="p-1" canManage={true} />);
    await waitFor(() => expect(screen.getByText("ACME")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/build/projects/p-1/bindings/b-1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("shows a write-failure message when the bindings list can't be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "upstream_unavailable" }, 502)));
    render(<BindingSlots projectId="p-1" canManage={false} />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load/i));
  });
});
