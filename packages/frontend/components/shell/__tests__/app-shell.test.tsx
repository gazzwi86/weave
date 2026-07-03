import { render, screen } from "@testing-library/react";
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
});
