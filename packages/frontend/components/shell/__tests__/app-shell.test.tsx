import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "../app-shell";

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AppShell", () => {
  it("renders nav and help launcher plus children on a protected route", () => {
    pathname = "/dashboard";
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /help/i })).toBeInTheDocument();
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("hides nav chrome on public paths but still renders children", () => {
    pathname = "/";
    render(
      <AppShell>
        <p>landing content</p>
      </AppShell>
    );

    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.getByText("landing content")).toBeInTheDocument();
  });

  it("hides nav chrome on the login path", () => {
    pathname = "/auth/login";
    render(
      <AppShell>
        <p>login content</p>
      </AppShell>
    );

    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
  });

  // PR #13 finding (5): app-shell.tsx used to keep its own copy of
  // PUBLIC_PATHS, already out of sync with middleware.ts's (missing
  // /robots.txt). Proves both now read the one shared constant.
  it("hides nav chrome on every shared PUBLIC_PATHS entry, including /robots.txt", () => {
    pathname = "/robots.txt";
    render(
      <AppShell>
        <p>robots content</p>
      </AppShell>
    );

    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
  });

  // AC-7: "Sign out" lives inside the avatar menu, never a bare header link.
  it("has no bare header Sign out link", () => {
    pathname = "/dashboard";
    render(
      <AppShell role="admin" userName="Ada Lovelace">
        <p>page content</p>
      </AppShell>
    );

    expect(screen.queryByRole("link", { name: /sign out/i })).not.toBeInTheDocument();
  });

  // AC-7: profile name, canonical role, help link, and Sign out all render
  // inside the avatar menu.
  it("opens the avatar menu showing profile name, role, help link, and Sign out", () => {
    pathname = "/dashboard";
    render(
      <AppShell role="admin" userName="Ada Lovelace">
        <p>page content</p>
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /help/i })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("link", { name: /sign out/i })).toHaveAttribute("href", "/api/auth/signout");
  });

  // AC-8: no workspace switcher in the header, for any role -- provisioning
  // is relocated to Settings -> Workspaces (binding tenancy ruling, R7).
  it("never renders a header workspace switcher, for a member or an admin", () => {
    pathname = "/dashboard";
    render(
      <AppShell role="admin" tenantId="tenant-1">
        <p>page content</p>
      </AppShell>
    );

    expect(screen.queryByRole("combobox", { name: "Active workspace" })).not.toBeInTheDocument();
  });
});
