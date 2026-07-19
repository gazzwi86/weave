import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarMenu } from "../avatar-menu";

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json" } });
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
}

describe("AvatarMenu", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // V5: refit-mock.html's "Operator console — provision companies" entry
  // is gated by the same isPlatformOperator predicate as the /operator
  // route itself (lib/auth/session-claims.ts), so a platform operator sees
  // the link and a regular member never does.
  it("shows the Operator console link for a platform operator role", () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
    render(<AvatarMenu userName="Priya Shah" role="admin" />);
    openMenu();

    expect(screen.getByRole("link", { name: /operator console/i })).toHaveAttribute("href", "/operator");
  });

  // S7: a session with no `name` claim previously fell back to the sentence
  // "Signed in", which the initials-deriver then read as a first+last name
  // ("SI") -- nonsense letters shown as the header avatar badge.
  it("shows a '?' badge instead of deriving fake initials when there is no real name", () => {
    render(<AvatarMenu userName={null} role="admin" />);

    expect(screen.getByRole("button", { name: /account menu/i })).toHaveTextContent("?");
  });

  it("derives a single initial from a one-word name", () => {
    render(<AvatarMenu userName="admin" role="admin" />);

    expect(screen.getByRole("button", { name: /account menu/i })).toHaveTextContent("A");
  });

  it("hides the Operator console link for a non-privileged role", () => {
    render(<AvatarMenu userName="Ada Lovelace" role="author" />);
    openMenu();

    expect(screen.queryByRole("link", { name: /operator console/i })).not.toBeInTheDocument();
  });

  it("hides the Operator console link when role is unresolved", () => {
    render(<AvatarMenu userName="Ada Lovelace" role={null} />);
    openMenu();

    expect(screen.queryByRole("link", { name: /operator console/i })).not.toBeInTheDocument();
  });

  // V6: the super-admin company switcher lives in the same flyout, above
  // the item list, gated by resolveHeaderScope's showHeaderSwitcher.
  it("shows the company switcher for a platform operator role and loads it on open", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/active")) return jsonResponse({ workspace_id: "ws-hammerbarn" });
      return jsonResponse([{ id: "ws-hammerbarn", slug: "hammerbarn", display_name: "Hammerbarn" }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AvatarMenu userName="Priya Shah" role="admin" />);
    openMenu();
    await flushMicrotasks();

    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hammerbarn/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/tenancy/workspaces");
  });

  it("hides the company switcher for a non-privileged role", () => {
    render(<AvatarMenu userName="Ada Lovelace" role="author" />);
    openMenu();

    expect(screen.queryByText("Company")).not.toBeInTheDocument();
  });

  it("switching to a different company posts to the switch endpoint", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/switch")) return jsonResponse({ workspace_id: "ws-acme" });
      if (url.includes("/active")) return jsonResponse({ workspace_id: "ws-hammerbarn" });
      return jsonResponse([
        { id: "ws-hammerbarn", slug: "hammerbarn", display_name: "Hammerbarn" },
        { id: "ws-acme", slug: "acme", display_name: "Acme Industrial" },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "location", { value: { ...window.location, reload: vi.fn() }, writable: true });

    render(<AvatarMenu userName="Priya Shah" role="admin" />);
    openMenu();
    await flushMicrotasks();

    fireEvent.click(screen.getByRole("button", { name: /Acme Industrial/ }));
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledWith("/api/tenancy/workspaces/ws-acme/switch", { method: "POST" });
  });
});
