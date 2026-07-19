import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../app-shell";

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AppShell", () => {
  // ONB-TASK-013: HelpLauncher's unread-dot fetches /api/onboarding/state on
  // mount -- stub it so unrelated AppShell tests don't hit jsdom's no-base-URL
  // fetch failure.
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockImplementation(() => Promise.resolve(Response.json({})));
  });


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

  // AC-1 (v5 shell): the sidebar collapses from its own head and re-expands
  // from the top-bar affordance -- the two share one persisted state.
  it("collapses the sidebar and re-expands it from the top-bar button", () => {
    pathname = "/ce/query";
    localStorage.clear();
    render(
      <AppShell role="admin">
        <p>page content</p>
      </AppShell>
    );

    expect(screen.getByRole("navigation", { name: "Secondary" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    expect(screen.queryByRole("navigation", { name: "Secondary" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand sidebar/i }));
    expect(screen.getByRole("navigation", { name: "Secondary" })).toBeInTheDocument();
  });
});

// S2 (docs/design/remediation-2-api-gaps.md): breadcrumb must resolve to the
// CURRENT subpage, not always fall back to the section's first item (e.g.
// /ce/types was showing "Constitution / Overview" for every CE subpage).
// Covers CE, Audit trail, Build, and the Settings subpages the same bug also
// broke (the brief's "Settings/Billing already works" claim only held for
// the exact-match/no-collision routes -- /settings/members and
// /settings/onboarding-path were broken by the identical root cause). Split
// into its own describe (rather than growing "AppShell" above) to stay under
// the function-length budget.
describe("AppShell breadcrumb", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockImplementation(() => Promise.resolve(Response.json({})));
  });

  it.each([
    ["/ce/types", "Constitution", "Ontology / Types"],
    ["/ce/instances", "Constitution", "Instances / Data"],
    ["/ce/query", "Constitution", "Query"],
    ["/ce/glossary", "Constitution", "Glossary"],
    ["/ce/brand", "Constitution", "Branding & standards"],
    ["/ce/rules", "Constitution", "Rules & policies"],
    ["/audit/logs", "Audit trail", "View logs"],
    ["/audit/compliance", "Audit trail", "Compliance"],
    ["/settings/members", "Settings", "Members"],
    ["/settings/onboarding-path", "Settings", "Onboarding path"],
    ["/build", "Build", "Registry"],
  ])("resolves the breadcrumb for %s to %s / %s", (path, sectionLabel, pageLabel) => {
    pathname = path;
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>
    );

    expect(screen.getByTestId("breadcrumb").textContent).toBe(`${sectionLabel}/${pageLabel}`);
  });
});
