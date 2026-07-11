import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import RoleHomePage from "../page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const ROLE_HOME_BODY = {
  capabilities: [
    { id: "explore", label: "Explore the model", href: "/ce", available: true, coming_soon: null },
    {
      id: "build-generate",
      label: "Generate an app from your model",
      href: null,
      available: false,
      coming_soon: "Available when the Build Engine ships",
    },
  ],
  summary: { kinds: 13, instances: 412 },
  next_action: { label: "Resolve 3 SHACL violations", href: "/audit/compliance" },
  completeness: [{ kind: "Process", instance_count: 42, coverage_gap_count: 3 }],
  tiles: [
    {
      id: "w-1",
      scope: "role_home",
      spec: {
        component_type: "kpi_card",
        title: "Modelled kinds",
        data_source_contracts: ["CE-METRICS-1"],
        bindings: { field: "kinds" },
        column_span: 3,
      },
      position: 0,
      last_result: 13,
      fetched_at: "2026-07-10T12:00:00Z",
      status: "fresh",
      pending_fields: [],
      suggested: false,
    },
  ],
};

function stubFetch(url: string): Response {
  if (url.includes("/api/role-home")) {
    return new Response(JSON.stringify(ROLE_HOME_BODY), { status: 200 });
  }
  return new Response("not found", { status: 404 });
}

describe("RoleHomePage", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => stubFetch(String(input)))
    );
  });

  it("AC-1: renders the recommended next action derived from live data", async () => {
    render(await RoleHomePage());

    expect(screen.getByTestId("next-action-banner")).toHaveTextContent(
      "Resolve 3 SHACL violations"
    );
  });

  it("AC-1: renders an available capability as a link", async () => {
    render(await RoleHomePage());

    const link = screen.getByRole("link", { name: "Explore the model" });
    expect(link).toHaveAttribute("href", "/ce");
  });

  it("AC-2: renders a gated capability in the coming-soon state, never hidden", async () => {
    render(await RoleHomePage());

    const card = screen.getByTestId("capability-build-generate");
    expect(card).toHaveTextContent("Coming soon");
    expect(card).toHaveTextContent("Available when the Build Engine ships");
  });

  it("AC-3: renders the per-kind completeness row from the composed payload", async () => {
    render(await RoleHomePage());

    const row = screen.getByTestId("completeness-row-Process");
    expect(row).toHaveTextContent("Process");
    expect(row).toHaveTextContent("42");
    expect(row).toHaveTextContent("3");
  });

  it("AC-5: renders the role-home SWR tile via the same WidgetGrid as the dashboard", async () => {
    render(await RoleHomePage());

    expect(screen.getByTestId("widget-tile-w-1")).toHaveTextContent("Modelled kinds");
  });

  it("renders the page title via PageHeader at --text-h1", async () => {
    render(await RoleHomePage());

    const heading = screen.getByRole("heading", { level: 1, name: "What can Weave do for you?" });
    expect(heading.className).toContain("text-[length:var(--text-h1)]");
  });

  it("degrades to an error message when the backend call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("error", { status: 500 }))
    );

    render(await RoleHomePage());

    expect(screen.getByTestId("role-home-error")).toBeInTheDocument();
  });
});
