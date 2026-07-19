import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MembersPanel } from "../members-panel";
import { CANONICAL_ROLES } from "../roles";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const MEMBERS = [
  {
    user_sub: "sub-priya",
    email: "priya@hammerbarn.com.au",
    display_name: "Priya Shah",
    role: "workspace_admin",
    status: "active",
    invited_at: "2026-01-01T00:00:00Z",
  },
  {
    user_sub: null,
    email: "marco@hammerbarn.com.au",
    display_name: "Marco Diaz",
    role: "engineer",
    status: "pending",
    invited_at: "2026-02-02T00:00:00Z",
  },
];

function stubFetch(members: typeof MEMBERS = MEMBERS) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/tenancy/workspaces/active") {
      return jsonResponse({ workspace_id: "ws-1" });
    }
    if (url === "/api/tenancy/workspaces/ws-1/members") {
      return jsonResponse({ members });
    }
    return jsonResponse({ members: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("MembersPanel table (mock #sub-set-members)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders each member's name, email, status and invited date", async () => {
    stubFetch();
    render(<MembersPanel />);

    expect(await screen.findByText("Priya Shah")).toBeInTheDocument();
    expect(screen.getByText("priya@hammerbarn.com.au")).toBeInTheDocument();
    // StatusPill only knows active/published/draft/custom -- a non-"active"
    // member status (e.g. "pending") maps to the neutral "draft" pill.
    expect(screen.getAllByText("active")).toHaveLength(1);
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("shows a Revoke action only for a member with a user_sub (has signed in)", async () => {
    stubFetch();
    render(<MembersPanel />);

    await screen.findByText("Priya Shah");
    expect(screen.getByRole("button", { name: /revoke priya shah/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke marco diaz/i })).not.toBeInTheDocument();
  });

  it("disables the inline role select (role changes coming soon)", async () => {
    stubFetch();
    render(<MembersPanel />);

    await screen.findByText("Priya Shah");
    const roleSelects = screen.getAllByRole("combobox", { name: /role for/i });
    expect(roleSelects.length).toBeGreaterThan(0);
    for (const select of roleSelects) expect(select).toBeDisabled();
  });

  it("filters the table by the search box", async () => {
    stubFetch();
    render(<MembersPanel />);

    await screen.findByText("Priya Shah");
    fireEvent.change(screen.getByLabelText(/search members/i), { target: { value: "marco" } });

    expect(screen.queryByText("Priya Shah")).not.toBeInTheDocument();
    expect(screen.getByText("Marco Diaz")).toBeInTheDocument();
  });

  it("filters the table to Admins via the filter chip", async () => {
    stubFetch();
    render(<MembersPanel />);

    await screen.findByText("Priya Shah");
    fireEvent.click(screen.getByRole("button", { name: "Admins" }));

    expect(screen.getByText("Priya Shah")).toBeInTheDocument();
    expect(screen.queryByText("Marco Diaz")).not.toBeInTheDocument();
  });
});

describe("MembersPanel invite modal (AC-2/AC-3)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the invite modal and offers only the 10 canonical in-tenant roles, never a Weave super-admin role", async () => {
    stubFetch([]);
    render(<MembersPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Invite member" }));

    const select = await screen.findByTestId("invite-role-select");
    const options = screen.getAllByRole("option").map((opt) => (opt as HTMLOptionElement).value);
    expect(options).toEqual(CANONICAL_ROLES.map((r) => r.slug));
    expect(options).not.toContain("weave_super_admin");
    expect(options).not.toContain("super_admin");
    expect(options).toHaveLength(10);
    expect(select).toBeInTheDocument();
  });

  it("shows an inline error and does not call the invite endpoint when Email is empty", async () => {
    const fetchMock = stubFetch([]);
    render(<MembersPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Invite member" }));
    await screen.findByTestId("invite-role-select");
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    expect(screen.getByTestId("invite-field-error")).toHaveTextContent("Email is required.");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/members"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("closes the modal on Cancel", async () => {
    stubFetch([]);
    render(<MembersPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Invite member" }));
    await screen.findByTestId("invite-role-select");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByTestId("invite-role-select")).not.toBeInTheDocument());
  });
});
