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
});
