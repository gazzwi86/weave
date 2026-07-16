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

describe("MembersPanel invite role selector (AC-3)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers only the 10 canonical in-tenant roles, never a Weave super-admin role", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/tenancy/workspaces/active") {
        return jsonResponse({ workspace_id: "ws-1" });
      }
      return jsonResponse({ members: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MembersPanel />);

    await waitFor(() => expect(screen.getByTestId("invite-role-select")).toBeInTheDocument());

    const options = screen.getAllByRole("option").map((opt) => (opt as HTMLOptionElement).value);
    expect(options).toEqual(CANONICAL_ROLES.map((r) => r.slug));
    expect(options).not.toContain("weave_super_admin");
    expect(options).not.toContain("super_admin");
    expect(options).toHaveLength(10);
  });
});

describe("MembersPanel invite form validation (BUG-04)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an inline error and does not call the invite endpoint when Email is empty", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/tenancy/workspaces/active") {
        return jsonResponse({ workspace_id: "ws-1" });
      }
      return jsonResponse({ members: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MembersPanel />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Invite" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    expect(screen.getByTestId("invite-field-error")).toHaveTextContent("Email is required.");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/members"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
